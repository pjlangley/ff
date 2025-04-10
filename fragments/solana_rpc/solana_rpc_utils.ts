import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";

export const initRpcClient = () => {
  const isCI = getEnvVar("CI");
  return createSolanaRpc(`http://${isCI ? "solana-validator" : "127.0.0.1"}:8899`);
};

export const initRpcSubscriptionsClient = () => {
  const isCI = getEnvVar("CI");
  return createSolanaRpcSubscriptions(`ws://${isCI ? "solana-validator" : "127.0.0.1"}:8900`);
};
