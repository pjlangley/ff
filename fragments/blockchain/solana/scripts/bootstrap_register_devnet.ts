// One-shot bootstrap for the `register` program's registry on devnet.
//
// `initialise_registry` is a one-time, irreversible call that must be signed by the program's
// upgrade authority (the deployer keypair). This signer becomes the `registry_state.authority`
// forever, so this is part of the manual deploy ceremony - it is deliberately **not** run in CI.
//
// The `register` program has two independent devnet instances (dev / prod), so the target program
// id is always passed explicitly via REGISTER_PROGRAM_ID - see ./devnet.example.env.
//
// Run via: `npx tsx --env-file ./devnet.env ./bootstrap_register_devnet.ts`, which supplies the Helius
// RPC URL and REGISTER_PROGRAM_ID through `./devnet.env`. The deployer keypair path is resolved
// relative to this script.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { address, createKeyPairSignerFromBytes, KeyPairSigner } from "@solana/kit";
import { initialiseRegistry } from "../../../solana_program_register/solana_register_interface";
import { getEnvVar } from "../../../env_vars/env_vars_utils";

const deployerKeypairPath = join(__dirname, "../devnet_deployer.id.json");

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
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
  const authority = await loadKeypairFromFile(deployerKeypairPath);
  console.log(`Authority (deployer): ${authority.address}`);
  console.log(`Program: ${registerProgramAddress}`);

  const signature = await initialiseRegistry(authority, registerProgramAddress);
  console.log(`✅ initialise_registry sent: ${signature}`);
  console.log(`Transaction: https://solscan.io/tx/${signature}?cluster=devnet`);
  console.log(`Program: https://solscan.io/account/${registerProgramAddress}?cluster=devnet`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
