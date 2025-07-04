import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { getCount, incrementCounter, initializeAccount } from "./solana_counter_interface";
import { Address, address, generateKeyPairSigner } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("solana program counter interface", () => {
  let programAddress: Address;

  before(() => {
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
