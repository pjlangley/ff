import { Signature } from "@solana/kit";
import { initRpcClient, initRpcSubscriptionsClient } from "../solana_rpc/solana_rpc_utils";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
  rpc: initRpcClient(),
  rpcSubscriptions: initRpcSubscriptionsClient(),
});

export const confirmRecentSignature = async (signature: Signature) => {
  try {
    await getRecentSignatureConfirmationPromise({
      commitment: "confirmed",
      signature,
      abortSignal: AbortSignal.timeout(5000),
    });
    return true;
  } catch (err) {
    console.error("Signature confirmation failed:", err);
    return false;
  }
};
