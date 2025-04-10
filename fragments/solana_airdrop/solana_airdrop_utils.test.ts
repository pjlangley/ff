import { getBalance } from "../solana_balance/solana_balance_utils";
import { createKeyPair, getAddress } from "../solana_key_pair/solana_key_pair_utils";
import { airdrop } from "./solana_airdrop_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { initRpcClient, initRpcSubscriptionsClient } from "../solana_rpc/solana_rpc_utils";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

describe("solana airdrop utils", () => {
  test("airdrop to new address", async () => {
    const rpcClient = initRpcClient();
    const rpcSubscriptionsClient = initRpcSubscriptionsClient();
    const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
      rpc: rpcClient,
      rpcSubscriptions: rpcSubscriptionsClient,
    });
    const keypair = await createKeyPair();
    const address = await getAddress(keypair);
    const balance = await getBalance(address);

    assert.strictEqual(balance, 0n);

    const airdropSignature = await airdrop(address, 1_000_000n);
    await getRecentSignatureConfirmationPromise({
      commitment: "confirmed",
      signature: airdropSignature,
      abortSignal: AbortSignal.timeout(5000),
    });

    const newBalance = await getBalance(address);
    assert.strictEqual(newBalance, 1_000_000n);
  });
});
