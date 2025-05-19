import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { airdrop } from "../solana_airdrop/solana_airdrop_utils";
import {
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
} from "@solana/kit";
import { confirmRecentSignature } from "./solana_transaction_utils";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";

describe("solana transaction utils", () => {
  test("confirmRecentSignature success", async () => {
    const keypair = await generateKeyPairSigner();
    const airdropSig = await airdrop(keypair.address, 1_000_000_000n);
    const isConfirmed = await confirmRecentSignature(airdropSig);

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
