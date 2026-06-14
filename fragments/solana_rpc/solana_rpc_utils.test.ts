import { initRpcClient, initRpcSubscriptionsClient, waitForSlot } from "./solana_rpc_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import process from "node:process";

describe("solana rpc utils", () => {
  test("initRpcClient", async () => {
    const client = initRpcClient();
    const blockHeight = await client.getBlockHeight().send();
    assert.strictEqual(blockHeight > 0, true);
  });

  test("initRpcClient prefers SOLANA_RPC_URL over the SOLANA_HOST default", async () => {
    process.env.SOLANA_HOST = "host.io";
    process.env.SOLANA_RPC_URL = "http://127.0.0.1:8899";

    try {
      const client = initRpcClient();
      const blockHeight = await client.getBlockHeight().send();
      assert.strictEqual(blockHeight > 0, true);
    } finally {
      delete process.env.SOLANA_HOST;
      delete process.env.SOLANA_RPC_URL;
    }
  });

  test("initRpcSubscriptionsClient", async () => {
    const client = initRpcSubscriptionsClient();
    const slotNotifications = await client.slotNotifications().subscribe({ abortSignal: AbortSignal.timeout(500) });

    for await (const notification of slotNotifications) {
      assert.strictEqual(notification.slot > 0, true);
    }
  });

  describe("waitForSlot", () => {
    test("successfully waits for a slot", async () => {
      const client = initRpcClient();
      const currentSlot = await client.getSlot({ commitment: "confirmed" }).send();
      const atSlot = await waitForSlot(currentSlot + 1n);
      assert.ok(atSlot);
    });

    test("slot is not reached within timeout", async () => {
      const client = initRpcClient();
      const currentSlot = await client.getSlot({ commitment: "confirmed" }).send();
      const atSlot = await waitForSlot(currentSlot + 50n, 500);
      assert.strictEqual(atSlot, false);
    });
  });
});
