import { Address, createSolanaRpc } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";

export const getBalance = async (address: Address) => {
  const isCI = getEnvVar("CI");
  const rpc = createSolanaRpc(`http://${isCI ? "solana-validator" : "127.0.0.1"}:8899`);
  const { value } = await rpc.getBalance(address).send();
  return value;
};
