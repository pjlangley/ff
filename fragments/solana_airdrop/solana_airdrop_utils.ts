import { Address, lamports } from "@solana/kit";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";

export const sendAndConfirmAirdrop = async (address: Address, amount: bigint) => {
  const client = initRpcClient();
  const airdropAmount = lamports(amount);

  console.log(`Airdropping ${new Intl.NumberFormat().format(amount)} lamports to ${address}`);

  const sig = await client.requestAirdrop(address, airdropAmount, { commitment: "confirmed" }).send();
  const isConfirmed = await confirmRecentSignature(sig);

  if (!isConfirmed) {
    throw new Error(`Airdrop was not confirmed for ${address} with signature ${sig}`);
  }

  console.log(`Airdrop confirmed for ${address} with signature ${sig}`);
};
