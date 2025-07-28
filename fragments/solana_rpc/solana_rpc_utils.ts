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

export const waitForSlot = async (slot: bigint, timeout = 5000) => {
  const client = initRpcClient();
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const currentSlot = await client.getSlot({ commitment: "confirmed" }).send();
    if (currentSlot >= slot) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
};
