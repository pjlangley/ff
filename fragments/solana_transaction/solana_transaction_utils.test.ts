import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { airdrop } from "../solana_airdrop/solana_airdrop_utils";
import { generateKeyPairSigner } from "@solana/kit";
import { confirmRecentSignature } from "./solana_transaction_utils";

describe("solana transaction utils", () => {
  test("confirmRecentSignature", async () => {
    const keypair = await generateKeyPairSigner();
    const airdropSig = await airdrop(keypair.address, 1_000_000_000n);
    const isConfirmed = await confirmRecentSignature(airdropSig);

    assert.strictEqual(isConfirmed, true);
  });
});
