import {
  CompilableTransactionMessage,
  getComputeUnitEstimateForTransactionMessageFactory,
  prependTransactionMessageInstruction,
  Signature,
} from "@solana/kit";
import { initRpcClient, initRpcSubscriptionsClient } from "../solana_rpc/solana_rpc_utils";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";

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

export const setComputeUnitLimitForTransaction = async (tx: CompilableTransactionMessage) => {
  const client = initRpcClient();
  const getComputeUnitEstimateForTransactionMessage = getComputeUnitEstimateForTransactionMessageFactory({
    rpc: client,
  });
  const computeUnitsEstimate = await getComputeUnitEstimateForTransactionMessage(tx);
  const computeUnitsEstimateWithBuffer = Math.ceil(computeUnitsEstimate * 1.1);

  return prependTransactionMessageInstruction(
    getSetComputeUnitLimitInstruction({ units: computeUnitsEstimateWithBuffer }),
    tx,
  );
};
