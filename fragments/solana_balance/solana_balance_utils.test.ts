import { getBalance } from "./solana_balance_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";

describe("solana balance utils", () => {
  test("getBalance", async () => {
    const keypair = await generateKeyPairSigner();
    const address = keypair.address;
    const balance = await getBalance(address);

    assert.strictEqual(balance, 0n);
  });
});
