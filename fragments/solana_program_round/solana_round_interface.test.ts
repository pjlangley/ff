import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import { activateRound, completeRound, getRoundAccount, initialiseRound } from "./solana_round_interface";
import { Address, address, generateKeyPairSigner, isNone, isSome } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { initRpcClient, waitForSlot } from "../solana_rpc/solana_rpc_utils";

interface ProgramError {
  context: { logs: string[] };
}

describe("solana program round interface", () => {
  let programAddress: Address;
  const client = initRpcClient();

  before(() => {
    const programId = getEnvVar("round_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable round_PROGRAM_ID is not set");
    }

    programAddress = address(programId);
  });

  test("initialise, activate & complete round", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
    const recentSlot = await client.getSlot({ commitment: "confirmed" }).send();
    const startSlot = recentSlot + 3n;

    const txSig = await initialiseRound(signer, programAddress, startSlot);
    await confirmRecentSignature(txSig);

    let roundAccount = await getRoundAccount(signer.address, programAddress);
    assert.strictEqual(roundAccount.start_slot, startSlot);
    assert.strictEqual(roundAccount.authority, signer.address);
    assert.ok(isNone(roundAccount.activated_at));
    assert.ok(isNone(roundAccount.activated_by));
    assert.ok(isNone(roundAccount.completed_at));

    const atSlot = await waitForSlot(startSlot);
    if (!atSlot) {
      assert.fail(`Round start slot ${startSlot} not reached within timeout`);
    }

    const txSigActivate = await activateRound(signer, programAddress, signer.address);
    await confirmRecentSignature(txSigActivate);

    roundAccount = await getRoundAccount(signer.address, programAddress);
    assert.ok(isSome(roundAccount.activated_at));
    assert.ok(isSome(roundAccount.activated_by));

    const txSigComplete = await completeRound(signer, programAddress);
    await confirmRecentSignature(txSigComplete);

    roundAccount = await getRoundAccount(signer.address, programAddress);
    assert.ok(isSome(roundAccount.completed_at));
  });

  test("initialise round with invalid start slot", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
    const recentSlot = await client.getSlot({ commitment: "confirmed" }).send();
    const startSlot = recentSlot - 1n;

    assert.rejects(async () => {
      await initialiseRound(signer, programAddress, startSlot);
    }, (err: ProgramError) => {
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /InvalidStartSlot/);
      return true;
    });
  });

  test("activate round before initialisation", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    assert.rejects(async () => {
      await activateRound(signer, programAddress, signer.address);
    }, (err: ProgramError) => {
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /expected this account to be already initialized/);
      return true;
    });
  });

  test("activate round at invalid slot", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
    const recentSlot = await client.getSlot({ commitment: "confirmed" }).send();
    const startSlot = recentSlot + 50n;

    const txSig = await initialiseRound(signer, programAddress, startSlot);
    await confirmRecentSignature(txSig);

    assert.rejects(async () => {
      await activateRound(signer, programAddress, signer.address);
    }, (err: ProgramError) => {
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /InvalidRoundActivationSlot/);
      return true;
    });
  });

  test("complete round before initialisation", async () => {
    const signer = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

    assert.rejects(async () => {
      await completeRound(signer, programAddress);
    }, (err: ProgramError) => {
      const errorMessage = err.context.logs.join(" ");
      assert.match(errorMessage, /expected this account to be already initialized/);
      return true;
    });
  });
});
