import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { getCount, incrementCounter, initializeAccount } from "./solana_counter_interface";
import { Address, address, generateKeyPairSigner } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { access, constants } from "node:fs/promises";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("solana program counter interface", () => {
  let programAddress: Address;

  before(async () => {
    const programKeysFile = "solana_program_keys/solana_program_keys.env";
    let programKeysFileExists = false;

    try {
      await access(programKeysFile, constants.R_OK);
      programKeysFileExists = true;
    } catch (_) {
      console.info(`${programKeysFile} not found, skipping loading environment variables`);
    }

    if (programKeysFileExists) {
      const dotenv = await import("dotenv");
      const result = dotenv.config({ path: programKeysFile });

      if (result.error) {
        console.error(result.error);
        assert.fail(`Failed to load environment variables from ${programKeysFile}`);
      }

      console.info(`Environment variables loaded from ${programKeysFile}`, result.parsed);
    }

    const programId = getEnvVar("counter_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable counter_PROGRAM_ID is not set");
    }

    programAddress = address(programId);
  });

  test("initialize account", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const txSig = await initializeAccount(signer, programAddress);
    await confirmRecentSignature(txSig);

    const count = await getCount(signer, programAddress);
    assert.strictEqual(count, 0n);
  });

  test("initialize account and increment", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const txSig = await initializeAccount(signer, programAddress);
    await confirmRecentSignature(txSig);

    const count = await getCount(signer, programAddress);
    assert.strictEqual(count, 0n);

    const incrementTxSig = await incrementCounter(signer, programAddress);
    await confirmRecentSignature(incrementTxSig);

    const latestCount = await getCount(signer, programAddress);
    assert.strictEqual(latestCount, 1n);
  });

  test("increment before initializing", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    assert.rejects(
      async () => {
        await incrementCounter(signer, programAddress);
      },
      {
        message: /^Transaction simulation failed/,
      },
    );
  });

  test("get count before initializing", async () => {
    const signer = await generateKeyPairSigner();

    assert.rejects(
      async () => {
        await getCount(signer, programAddress);
      },
      {
        message: /^Account .* does not exist/,
      },
    );
  });
});
