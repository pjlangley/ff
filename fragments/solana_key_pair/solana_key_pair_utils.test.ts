import { createKeyPair, getAddress } from "./solana_key_pair_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("solana key pair utils", () => {
  test("createKeyPair", async () => {
    const result = await createKeyPair();
    assert.strictEqual(result.privateKey.algorithm.name, "Ed25519");
    assert.strictEqual(result.publicKey.algorithm.name, "Ed25519");
  });

  test("getAddress", async () => {
    const keyPair = await createKeyPair();
    const result = await getAddress(keyPair.publicKey);
    assert.strictEqual(result.length, 44);
  });
});
