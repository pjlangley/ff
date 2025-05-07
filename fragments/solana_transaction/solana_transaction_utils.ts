import { Signature } from "@solana/kit";
import { initRpcClient, initRpcSubscriptionsClient } from "../solana_rpc/solana_rpc_utils";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

export const confirmRecentSignature = async (signature: Signature) => {
  const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
    rpc: initRpcClient(),
    rpcSubscriptions: initRpcSubscriptionsClient(),
  });

  await getRecentSignatureConfirmationPromise({
    commitment: "confirmed",
    signature,
    abortSignal: AbortSignal.timeout(5000),
  });

  return true;
};
