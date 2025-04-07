import { Address, createSolanaRpc, lamports } from "@solana/kit";
import { getEnvVar } from "../env_vars/env_vars_utils";

export const airdrop = async (address: Address, amount: bigint) => {
  const isCI = getEnvVar("CI");
  const rpc = createSolanaRpc(`http://${isCI ? "solana-validator" : "127.0.0.1"}:8899`);
  const airdropAmount = lamports(amount);

  console.log("Airdropping", new Intl.NumberFormat().format(amount), "lamports to:", address);

  const signature = await rpc.requestAirdrop(address, airdropAmount).send();
  return signature;
};
