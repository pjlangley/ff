import { Address, lamports } from "@solana/kit";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";

export const airdrop = async (address: Address, amount: bigint) => {
  const client = initRpcClient();
  const airdropAmount = lamports(amount);

  console.log("Airdropping", new Intl.NumberFormat().format(amount), "lamports to:", address);

  const signature = await client.requestAirdrop(address, airdropAmount, { commitment: "confirmed" }).send();
  return signature;
};
