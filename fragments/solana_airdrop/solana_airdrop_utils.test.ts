import { getBalance } from "../solana_balance/solana_balance_utils";
import { createKeyPair, getAddress } from "../solana_key_pair/solana_key_pair_utils";
import { airdrop } from "./solana_airdrop_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("solana airdrop utils", () => {
  test("airdrop to new address", async () => {
    const keypair = await createKeyPair();
    const address = await getAddress(keypair);
    const balance = await getBalance(address);

    assert.strictEqual(balance, 0n);

    await airdrop(address, 1_000_000n);

    const expectedBalance = 1_000_000n;
    const timeout = 5000;
    const interval = 100;
    let elapsed = 0;
    let newBalance = 0n;

    while (elapsed < timeout) {
      newBalance = await getBalance(address);
      if (newBalance === expectedBalance) break;
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
    }

    assert.strictEqual(newBalance, expectedBalance, `Balance not as expected within ${timeout}ms`);
  });
});
