import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  appendTransactionMessageInstruction,
  compileTransaction,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  signTransaction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  confirmRecentSignature,
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "./solana_transaction_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("solana transaction utils", () => {
  test("confirmRecentSignature success", async () => {
    const keypair = await generateKeyPairSigner();
    await sendAndConfirmAirdrop(keypair.address, BigInt(LAMPORTS_PER_SOL));

    const baseTx = await createBaseTxWithFeePayerAndLifetime(keypair.address);
    const tx = appendTransactionMessageInstruction(
      getTransferSolInstruction({
        source: keypair,
        destination: keypair.address,
        amount: 0,
      }),
      baseTx,
    );

    const sig = await signAndSendTransaction(tx, keypair.keyPair);
    const isConfirmed = await confirmRecentSignature(sig);
    assert.strictEqual(isConfirmed, true);
  });

  test("confirmRecentSignature failure", async () => {
    const keypair = await generateKeyPairSigner();
    const tx = await createBaseTxWithFeePayerAndLifetime(keypair.address);
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction([keypair.keyPair], compiledTx);
    const sig = getSignatureFromTransaction(signedTx);
    const isConfirmed = await confirmRecentSignature(sig, 50);

    assert.strictEqual(isConfirmed, false);
  });
});
