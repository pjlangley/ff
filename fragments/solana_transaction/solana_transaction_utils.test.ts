import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  appendTransactionMessageInstruction,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { confirmRecentSignature } from "./solana_transaction_utils";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("solana transaction utils", () => {
  test("confirmRecentSignature success", async () => {
    const keypair = await generateKeyPairSigner();
    const client = initRpcClient();
    await sendAndConfirmAirdrop(keypair.address, BigInt(LAMPORTS_PER_SOL));

    const { value: latestBlockhash } = await client.getLatestBlockhash().send();
    const tx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(keypair.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) =>
        appendTransactionMessageInstruction(
          getTransferSolInstruction({
            source: keypair,
            destination: keypair.address,
            amount: 0,
          }),
          tx,
        ),
    );
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction([keypair.keyPair], compiledTx);
    const serializedTransaction = getBase64EncodedWireTransaction(signedTx);
    const sig = await client.sendTransaction(serializedTransaction, { encoding: "base64" }).send();
    const isConfirmed = await confirmRecentSignature(sig);

    assert.strictEqual(isConfirmed, true);
  });

  test("confirmRecentSignature failure", async () => {
    const keypair = await generateKeyPairSigner();
    const client = initRpcClient();
    const { value: latestBlockhash } = await client.getLatestBlockhash().send();
    const tx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(keypair.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    );
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction([keypair.keyPair], compiledTx);
    const sig = getSignatureFromTransaction(signedTx);
    const isConfirmed = await confirmRecentSignature(sig, 50);

    assert.strictEqual(isConfirmed, false);
  });
});
