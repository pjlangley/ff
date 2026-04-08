import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { before, describe } from "node:test";
import process from "node:process";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import {
  confirmRegistration,
  getRegistrationAccount,
  getRegistryStateAccount,
  initialiseRegistry,
  register,
} from "./solana_register_interface";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  isNone,
  isSome,
  KeyPairSigner,
} from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface ProgramError {
  context: { logs: string[] };
}

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
};

describe("solana program register interface", () => {
  let programAddress: Address;
  let authority: KeyPairSigner;

  before(async () => {
    const programId = getEnvVar("register_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable register_PROGRAM_ID is not set");
    }

    programAddress = address(programId);

    // The registry can only be initialised by the program's upgrade authority (deployer).
    // Load the deployer keypair from file to use as the authority (CI/CD & local compatibility).
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? "./solana_program_keys/solana_deployer.json";
    authority = await loadKeypairFromFile(keypairPath);
    await sendAndConfirmAirdrop(authority.address, BigInt(LAMPORTS_PER_SOL));

    // Registry state is a singleton PDA (seeded only by "registry_state"),
    // so it must be initialised once and shared across all tests.
    // On subsequent runs against the same validator, initialisation will
    // fail because the account already exists — this is expected.
    try {
      const txSig = await initialiseRegistry(authority, programAddress);
      await confirmRecentSignature(txSig);
    } catch (e) {
      const err = e as ProgramError;
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /already in use/);
      console.log("Registry already initialised, skipping initialisation step");
    }
  });

  test("initialise registry", async () => {
    const registryState = await getRegistryStateAccount(programAddress);
    assert.strictEqual(registryState.authority, authority.address);
    assert.ok(registryState.registration_count >= 0n);
  });

  test("register and verify registration", async () => {
    const registrant = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(registrant.address, BigInt(LAMPORTS_PER_SOL));

    const registerTxSig = await register(registrant, programAddress);
    await confirmRecentSignature(registerTxSig);

    const registration = await getRegistrationAccount(registrant.address, programAddress);
    assert.strictEqual(registration.registrant, registrant.address);
    assert.ok(registration.registered_at > 0n);
    assert.ok(isNone(registration.confirmed_at));
  });

  test("confirm registration", async () => {
    const registrant = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(registrant.address, BigInt(LAMPORTS_PER_SOL));

    const registerTxSig = await register(registrant, programAddress);
    await confirmRecentSignature(registerTxSig);

    const confirmTxSig = await confirmRegistration(authority, programAddress, registrant.address);
    await confirmRecentSignature(confirmTxSig);

    const registration = await getRegistrationAccount(registrant.address, programAddress);
    assert.ok(isSome(registration.confirmed_at));
  });

  test("register multiple registrants", async () => {
    const registryStateBefore = await getRegistryStateAccount(programAddress);
    const countBefore = registryStateBefore.registration_count;

    const registrantA = await generateKeyPairSigner();
    const registrantB = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(registrantA.address, BigInt(LAMPORTS_PER_SOL));
    await sendAndConfirmAirdrop(registrantB.address, BigInt(LAMPORTS_PER_SOL));

    const regTxSigA = await register(registrantA, programAddress);
    await confirmRecentSignature(regTxSigA);

    const regTxSigB = await register(registrantB, programAddress);
    await confirmRecentSignature(regTxSigB);

    const registryStateAfter = await getRegistryStateAccount(programAddress);
    assert.strictEqual(registryStateAfter.registration_count, countBefore + 2n);

    const registrationA = await getRegistrationAccount(registrantA.address, programAddress);
    const registrationB = await getRegistrationAccount(registrantB.address, programAddress);
    assert.strictEqual(registrationB.registration_index, registrationA.registration_index + 1n);
  });

  test("confirm already confirmed registration", async () => {
    const registrant = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(registrant.address, BigInt(LAMPORTS_PER_SOL));

    const registerTxSig = await register(registrant, programAddress);
    await confirmRecentSignature(registerTxSig);

    const confirmTxSig = await confirmRegistration(authority, programAddress, registrant.address);
    await confirmRecentSignature(confirmTxSig);

    assert.rejects(async () => {
      await confirmRegistration(authority, programAddress, registrant.address);
    }, (err: ProgramError) => {
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /RegistrationAlreadyConfirmed/);
      return true;
    });
  });

  test("get registration account before it exists", async () => {
    const registrant = await generateKeyPairSigner();

    assert.rejects(async () => {
      await getRegistrationAccount(registrant.address, programAddress);
    }, {
      message: /^Account .* does not exist/,
    });
  });
});
