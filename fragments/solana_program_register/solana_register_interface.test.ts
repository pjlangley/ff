import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { before, describe } from "node:test";
import process from "node:process";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import {
  confirmRegistration,
  getRegistrationAccount,
  getRegistrationAccountByIndex,
  getRegistryStateAccount,
  initialiseRegistry,
  register,
  REGISTRATION_ACCOUNT_SIZE,
  REGISTRATION_INDEX_OFFSET,
  registrationIndexFilters,
} from "./solana_register_interface";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  getBase58Encoder,
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

    // The same account reached by index rather than by PDA — proves the memcmp filter against an
    // account the program itself serialised.
    const byIndex = await getRegistrationAccountByIndex(registration.registration_index, programAddress);
    assert.deepStrictEqual(byIndex, registration);
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
    assert.ok(registryStateAfter.registration_count >= countBefore + 2n);

    const registrationA = await getRegistrationAccount(registrantA.address, programAddress);
    const registrationB = await getRegistrationAccount(registrantB.address, programAddress);
    assert.ok(registrationB.registration_index > registrationA.registration_index);
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

  test("get registration account by an index nothing has reached", async () => {
    const registration = await getRegistrationAccountByIndex(2n ** 63n, programAddress);
    assert.strictEqual(registration, undefined);
  });
});

describe("solana program register registration index filter", () => {
  test("targets the registration_index field of the on-chain Registration layout", () => {
    const [dataSizeFilter, memcmpFilter] = registrationIndexFilters(258n);

    assert.strictEqual(dataSizeFilter.dataSize, BigInt(REGISTRATION_ACCOUNT_SIZE));
    assert.strictEqual(memcmpFilter.memcmp.offset, BigInt(REGISTRATION_INDEX_OFFSET));
    assert.strictEqual(memcmpFilter.memcmp.offset, 40n);
    assert.strictEqual(memcmpFilter.memcmp.encoding, "base58");

    // `memcmp` compares raw account bytes, so what matters is the byte layout the filter decodes to:
    // 258 as a little-endian u64 is 0x02 0x01 followed by six zero bytes. Written out by hand rather
    // than re-encoded here, so a big-endian slip in the filter cannot be mirrored by the assertion.
    assert.deepStrictEqual(
      new Uint8Array(getBase58Encoder().encode(memcmpFilter.memcmp.bytes)),
      new Uint8Array([2, 1, 0, 0, 0, 0, 0, 0]),
    );

    // Base58 reads those bytes back as one big-endian integer (144,396,663,052,566,528), so the wire
    // string bears no resemblance to 258. Pinned to catch a change of alphabet, which the byte
    // assertion above would not: `getBase58Encoder` would decode any alphabet the encoder used.
    assert.strictEqual(memcmpFilter.memcmp.bytes, "LSYWV7p8gw");
  });
});
