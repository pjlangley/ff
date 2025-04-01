import { getBalance } from "./solana_balance_utils";
import { createKeyPair, getAddress } from "../solana_key_pair/solana_key_pair_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("solana balance utils", () => {
  test("getBalance", async () => {
    const keypair = await createKeyPair();
    const address = await getAddress(keypair);
    const balance = await getBalance(address);

    assert.strictEqual(balance, 0n);
  });
});
