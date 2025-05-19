import { getBalance } from "../solana_balance/solana_balance_utils";
import { airdrop } from "./solana_airdrop_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import { generateKeyPairSigner } from "@solana/kit";

describe("solana airdrop utils", () => {
  test("airdrop to new address", async () => {
    const keypair = await generateKeyPairSigner();
    const address = keypair.address;
    const balance = await getBalance(address);
    assert.strictEqual(balance, 0n);

    const airdropSignature = await airdrop(address, 1_000_000n);
    const isConfirmed = await confirmRecentSignature(airdropSignature);
    assert.strictEqual(isConfirmed, true);

    const newBalance = await getBalance(address);
    assert.strictEqual(newBalance, 1_000_000n);
  });
});
