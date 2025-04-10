import { Address } from "@solana/kit";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";

export const getBalance = async (address: Address) => {
  const client = initRpcClient();
  const { value } = await client.getBalance(address, { commitment: "confirmed" }).send();
  return value;
};
