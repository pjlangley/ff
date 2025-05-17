import { Signature } from "@solana/kit";
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
