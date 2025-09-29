import {
  addItem,
  getAllItems,
  getItemByTicker,
  getItemsAfterLaunchYear,
  removeItem,
  updateItem,
} from "./postgres_crud";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { randomUUID } from "node:crypto";

describe("postgres crud", () => {
  describe("getting by ticker", () => {
    test("retrieves a known ticker", async () => {
      const result = await getItemByTicker("BTC");
      assert.strictEqual(result[0].ticker, "BTC");
      assert.strictEqual(result[0].name, "Bitcoin");
      assert.strictEqual(result[0].launched, 2009);
    });

    test("handles an unknown ticker", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = await getItemByTicker(ticker);
      assert.strictEqual(result.length, 0);
    });
  });

  describe("get items after launch year", () => {
    test("matching items after launch year", async () => {
      const result = await getItemsAfterLaunchYear(2000);
      assert.ok(result.length >= 3);
    });

    test("no matching items after launch year", async () => {
      const result = await getItemsAfterLaunchYear(2050);
      assert.strictEqual(result.length, 0);
    });
  });

  test("get all items", async () => {
    const result = await getAllItems();
    assert.ok(result.length >= 3);
  });

  describe("adding items", () => {
    test("adds an item to the database table", async () => {
      const result = await addItem({
        ticker: randomUUID().slice(0, 6).toUpperCase(),
        name: "Test coin",
        launched: 2023,
      });
      assert.strictEqual(result, "ok");
    });

    test("handles duplicates", async () => {
      const result = await addItem({
        ticker: "BTC",
        name: "Bitcoin",
        launched: 2009,
      });
      assert.strictEqual(result, "ok");
    });
  });

  describe("removing items", () => {
    test("removes an item from the database table", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = await addItem({
        ticker: ticker,
        name: "Test coin",
        launched: 2024,
      });
      assert.strictEqual(result, "ok");

      const deleteResult = await removeItem(ticker);
      assert.strictEqual(deleteResult.length, 1);
    });
  });

  describe("updating items", () => {
    test("nonexistent item", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = await updateItem({ ticker, name: "Unknown", launched: 2000 });
      assert.strictEqual(result.length, 0);
    });

    test("updates existing item", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      await addItem({
        ticker: ticker,
        name: "Test coin",
        launched: 2024,
      });

      const result = await updateItem({
        ticker,
        name: "Test coin updated",
        launched: 2025,
      });
      assert.strictEqual(result.length, 1);
    });
  });
});
