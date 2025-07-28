import { initRpcClient, initRpcSubscriptionsClient, waitForSlot } from "./solana_rpc_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("solana rpc utils", () => {
  test("initRpcClient", async () => {
    const client = initRpcClient();
    const blockHeight = await client.getBlockHeight().send();
    assert.strictEqual(blockHeight > 0, true);
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
