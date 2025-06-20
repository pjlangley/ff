import {
  Address,
  CompilableTransactionMessage,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  KeyPairSigner,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  Signature,
  signTransaction,
} from "@solana/kit";
import { initRpcClient, initRpcSubscriptionsClient } from "../solana_rpc/solana_rpc_utils";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
  rpc: initRpcClient(),
  rpcSubscriptions: initRpcSubscriptionsClient(),
});

export const confirmRecentSignature = async (signature: Signature, timeout = 5000) => {
  const abortSignal = AbortSignal.timeout(timeout);

  try {
    await Promise.race([
      // Note: `getRecentSignatureConfirmationPromise` silently fails if the transaction is not found in time
      getRecentSignatureConfirmationPromise({
        commitment: "confirmed",
        signature,
        abortSignal,
      }),
      new Promise((_, reject) => {
        abortSignal.addEventListener("abort", () => {
          reject(new Error("Signature confirmation timed out"));
        }, { once: true });
      }),
    ]);
    return true;
  } catch (err) {
    console.error("Error confirming signature:", err);
    return false;
  }
};

export const createBaseTxWithFeePayerAndLifetime = async (feePayer: Address) => {
  const client = initRpcClient();
  const { value: latestBlockhash } = await client.getLatestBlockhash().send();

  const tx = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  );

  return tx;
};

export const signAndSendTransaction = async (tx: CompilableTransactionMessage, keypair: KeyPairSigner["keyPair"]) => {
  const client = initRpcClient();
  const compiledTx = compileTransaction(tx);
  const signedTx = await signTransaction([keypair], compiledTx);
  const serializedTransaction = getBase64EncodedWireTransaction(signedTx);
  const signature = await client.sendTransaction(serializedTransaction, { encoding: "base64" }).send();

  return signature;
};
