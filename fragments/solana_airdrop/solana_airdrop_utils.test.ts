import { getBalance } from "../solana_balance/solana_balance_utils";
import { sendAndConfirmAirdrop } from "./solana_airdrop_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";

describe("solana airdrop utils", () => {
  test("sendAndConfirmAirdrop to new address", async () => {
    const keypair = await generateKeyPairSigner();
    const address = keypair.address;
    const balance = await getBalance(address);
    assert.strictEqual(balance, 0n);

    await sendAndConfirmAirdrop(address, 1_000_000_000n);
    const newBalance = await getBalance(address);
    assert.strictEqual(newBalance, 1_000_000_000n);
  });
});
