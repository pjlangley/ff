import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { airdrop } from "../solana_airdrop/solana_airdrop_utils";
import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { confirmRecentSignature, setComputeUnitLimitForTransaction } from "./solana_transaction_utils";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import { getAddMemoInstruction } from "@solana-program/memo";
import { Buffer } from "node:buffer";

describe("solana transaction utils", () => {
  test("confirmRecentSignature", async () => {
    const keypair = await generateKeyPairSigner();
    const airdropSig = await airdrop(keypair.address, 1_000_000_000n);
    const isConfirmed = await confirmRecentSignature(airdropSig);

    assert.strictEqual(isConfirmed, true);
  });

  test("setComputeUnitLimitForTransaction", async () => {
    const client = initRpcClient();
    const keypair = await generateKeyPairSigner();
    const airdropSig = await airdrop(keypair.address, 1_000_000_000n);
    await confirmRecentSignature(airdropSig);
    const { value: latestBlockhash } = await client.getLatestBlockhash().send();

    const tx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(keypair.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstruction(getAddMemoInstruction({ memo: "Hello, World!" }), tx),
    );
    const txWithCULimit = await setComputeUnitLimitForTransaction(tx);

    // txWithCULimit.instructions[0]:
    // {
    //   programAddress: 'ComputeBudget111111111111111111111111111111',
    //   data: Uint8Array(5) [ 2, 182, 27, 0, 0 ]
    // }

    const buffer = Buffer.from(txWithCULimit.instructions[0].data!);
    const instructionType = buffer[0]; // First raw byte of array is the instruction type
    const computeUnitEstimate = buffer.readUInt32LE(1);

    assert.strictEqual(instructionType, 2); // 2 = SetComputeUnitLimit
    assert.strictEqual(computeUnitEstimate > 0, true);
  });
});
