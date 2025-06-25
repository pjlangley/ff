import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import {
  getUsernameAccount,
  getUsernameRecordAccount,
  initializeUsername,
  updateUsername,
} from "./solana_username_interface";
import { Address, address, generateKeyPairSigner } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { AnchorError } from "@coral-xyz/anchor";

describe("solana program username interface", () => {
  let programAddress: Address;

  before(() => {
    const programId = getEnvVar("username_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable username_PROGRAM_ID is not set");
    }

    programAddress = address(programId);
  });

  test("initialize username", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const txSig = await initializeUsername(signer, programAddress, "my_username");
    await confirmRecentSignature(txSig);

    const userAccount = await getUsernameAccount(signer, programAddress);
    assert.strictEqual(userAccount.username.value, "my_username");
    assert.strictEqual(userAccount.authority, signer.address);
    assert.strictEqual(userAccount.change_count, 0n);
    assert.strictEqual(userAccount.username_recent_history.length, 0);
  });

  test("initialize username then update username", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const initSig = await initializeUsername(signer, programAddress, "my_username");
    await confirmRecentSignature(initSig);

    let userAccount = await getUsernameAccount(signer, programAddress);
    assert.strictEqual(userAccount.username.value, "my_username");

    const updateSig = await updateUsername(signer, programAddress, "new_username");
    await confirmRecentSignature(updateSig);

    userAccount = await getUsernameAccount(signer, programAddress);
    assert.strictEqual(userAccount.username.value, "new_username");
  });

  test("update username multiple times", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const initSig = await initializeUsername(signer, programAddress, "username_0");
    await confirmRecentSignature(initSig);

    for (let i = 0; i < 4; i++) {
      const sig = await updateUsername(signer, programAddress, `username_${i + 1}`);
      await confirmRecentSignature(sig);
    }

    const userAccount = await getUsernameAccount(signer, programAddress);
    assert.strictEqual(userAccount.username.value, "username_4");
    assert.strictEqual(userAccount.change_count, 4n);
    assert.strictEqual(userAccount.username_recent_history.length, 3);

    for (let i = 0; i < 4; i++) {
      const userRecordAccount = await getUsernameRecordAccount(signer, programAddress, BigInt(i));
      assert.strictEqual(userRecordAccount.old_username.value, `username_${i}`);
      assert.strictEqual(userRecordAccount.change_index, BigInt(i));
      assert.strictEqual(userRecordAccount.authority, signer.address);
    }
  });

  test("update username before initializing", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    assert.rejects(
      async () => {
        await updateUsername(signer, programAddress, "new_username");
      },
      {
        message: /^Account .* does not exist/,
      },
    );
  });

  test("get username account before initializing", async () => {
    const signer = await generateKeyPairSigner();

    assert.rejects(
      async () => {
        await getUsernameAccount(signer, programAddress);
      },
      {
        message: /^Account .* does not exist/,
      },
    );
  });

  test("get username record account before initializing", async () => {
    const signer = await generateKeyPairSigner();

    assert.rejects(
      async () => {
        await getUsernameRecordAccount(signer, programAddress, 0n);
      },
      {
        message: /^Account .* does not exist/,
      },
    );
  });

  test("provide invalid username at initialisation", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    assert.rejects(
      async () => {
        await initializeUsername(signer, programAddress, "new_username_!!!!");
      },
      (err) => {
        const anchorError = err as AnchorError;
        const cause = anchorError.cause as { message: string };
        assert.ok(cause.message.includes("6002"));
        return true;
      },
    );
  });

  test("provide invalid username when updating", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    const initSig = await initializeUsername(signer, programAddress, "username");
    await confirmRecentSignature(initSig);

    assert.rejects(
      async () => {
        await updateUsername(signer, programAddress, "x");
      },
      (err) => {
        const anchorError = err as AnchorError;
        const cause = anchorError.cause as { message: string };
        assert.ok(cause.message.includes("6001"));
        return true;
      },
    );
  });
});
