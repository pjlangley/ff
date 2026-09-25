// Registers one fresh account against the `register` program on devnet, to exercise the
// registration -> poller -> queue pipeline end to end.
//
// The registrant keypair is **ephemeral**: generated per run, used once, never persisted. There is
// deliberately no way to supply or recover one - if you need another registrant, run this again.
//
// `register` sets `payer = registrant`, so a brand new account cannot pay for its own `Registration`
// PDA. The devnet faucet is rate-limited and Helius refuses `requestAirdrop`, so the deployer keypair
// funds the registrant first. Hence two transactions per run.
//
// The `register` program has two independent devnet instances (dev / prod), so the target program
// id is always passed explicitly via REGISTER_PROGRAM_ID - see ./devnet.example.env.
//
// Run via: `npx tsx --env-file ./devnet.env ./register_user_devnet.ts`, which supplies the Helius
// RPC URL and REGISTER_PROGRAM_ID through `./devnet.env`. The deployer keypair path is resolved
// relative to this script.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  KeyPairSigner,
  Signature,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  getRegistrationAccount,
  getRegistryStateAccount,
  register,
} from "../../../solana_program_register/solana_register_interface";
import {
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "../../../solana_transaction/solana_transaction_utils";
import { initRpcClient } from "../../../solana_rpc/solana_rpc_utils";
import { getEnvVar } from "../../../env_vars/env_vars_utils";

const deployerKeypairPath = join(__dirname, "../devnet_deployer.id.json");

// The `Registration` PDA's rent-exempt minimum is 1,343,280 lamports for its 65 bytes, plus a 5,000
// lamport transaction fee. 0.01 SOL leaves roughly 7x headroom.
const FUNDING_LAMPORTS = 10_000_000n;

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
};

/**
 * The funding transfer has to land before `register` is sent, or it fails for insufficient funds -
 * so this script needs confirmation, unlike the bootstrap one.
 *
 * `confirmRecentSignature` can't provide it: it confirms over a websocket, and
 * `initRpcSubscriptionsClient` ignores SOLANA_RPC_URL and always points at localhost:8900, so on
 * devnet it times out and returns false. Polling `getSignatureStatuses` uses the HTTP client that
 * SOLANA_RPC_URL actually configures.
 */
const awaitConfirmation = async (signature: Signature, timeoutMs = 30_000) => {
  const client = initRpcClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [status] = (await client.getSignatureStatuses([signature]).send()).value;

    if (status?.err) {
      throw new Error(`Transaction ${signature} failed on-chain: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Transaction ${signature} was not confirmed within ${timeoutMs}ms`);
};

const main = async () => {
  // See ./devnet.example.env
  if (!getEnvVar("SOLANA_RPC_URL")) {
    throw new Error("environment variable SOLANA_RPC_URL is not set");
  }
  const programId = getEnvVar("REGISTER_PROGRAM_ID");
  if (!programId) {
    throw new Error("environment variable REGISTER_PROGRAM_ID is not set");
  }

  const registerProgramAddress = address(programId);
  const deployer = await loadKeypairFromFile(deployerKeypairPath);

  // Fails loudly if the registry was never bootstrapped, rather than leaving `register` to report it
  // as an opaque Anchor error. The count is also the index this run should be assigned.
  const registryState = await getRegistryStateAccount(registerProgramAddress);

  console.log(`Program: ${registerProgramAddress}`);
  console.log(`Funder (deployer): ${deployer.address}`);
  console.log(`Registrations so far: ${registryState.registration_count}`);

  const registrant = await generateKeyPairSigner();
  console.log(`Registrant (ephemeral): ${registrant.address}`);

  const fundingTx = appendTransactionMessageInstruction(
    getTransferSolInstruction({
      source: deployer,
      destination: registrant.address,
      amount: FUNDING_LAMPORTS,
    }),
    await createBaseTxWithFeePayerAndLifetime(deployer.address),
  );
  const fundingSignature = await signAndSendTransaction(fundingTx, deployer.keyPair);
  await awaitConfirmation(fundingSignature);
  console.log(`✅ funded with ${FUNDING_LAMPORTS} lamports: ${fundingSignature}`);

  const signature = await register(registrant, registerProgramAddress);
  await awaitConfirmation(signature);
  console.log(`✅ register sent: ${signature}`);

  const registration = await getRegistrationAccount(registrant.address, registerProgramAddress);
  console.log(`Assigned registration index: ${registration.registration_index}`);
  console.log(`Registered at slot: ${registration.registered_at}`);
  console.log(`Transaction: https://solscan.io/tx/${signature}?cluster=devnet`);
  console.log(`Registrant: https://solscan.io/account/${registrant.address}?cluster=devnet`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
