import {
  addItem,
  getAllItems,
  getItemByTicker,
  getItemsAfterLaunchYear,
  removeItem,
  updateItem,
} from "./postgres_crud";
import assert from "node:assert/strict";
import test, { after, describe } from "node:test";

describe("postgres crud", () => {
  describe("getting by ticker", () => {
    test("retrieves a known ticker", async () => {
      const result = await getItemByTicker("BTC");
      assert.strictEqual(result[0].ticker, "BTC");
      assert.strictEqual(result[0].name, "Bitcoin");
      assert.strictEqual(result[0].launched, 2009);
    });

    test("handles an unknown ticker", async () => {
      const result = await getItemByTicker("XRP");
      assert.strictEqual(result.length, 0);
    });
  });

  describe("get items after launch year", () => {
    test("matching items after launch year", async () => {
      const result = await getItemsAfterLaunchYear(2000);
      assert.strictEqual(result.length, 3);
    });

    test("no matching items after launch year", async () => {
      const result = await getItemsAfterLaunchYear(2020);
      assert.strictEqual(result.length, 0);
    });
  });

  test("get all items ordered by launch year", async () => {
    const result = await getAllItems();
    assert.strictEqual(result[0].ticker, "SOL");
    assert.strictEqual(result[1].ticker, "ETH");
    assert.strictEqual(result[2].ticker, "BTC");
  });

  describe("adding items", () => {
    after(async () => {
      await removeItem("PEPE");
    });

    test("adds an item to the database table", async () => {
      const result = await addItem({
        ticker: "PEPE",
        name: "Pepe",
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
      const result = await addItem({
        ticker: "WIF",
        name: "dogwifhat",
        launched: 2024,
      });
      assert.strictEqual(result, "ok");

      const deleteResult = await removeItem("WIF");
      assert.strictEqual(deleteResult.length, 1);
    });
  });

  describe("updating items", () => {
    test("nonexistent item", async () => {
      const result = await updateItem({ ticker: "UNKNOWN", name: "Unknown", launched: 2000 });
      assert.strictEqual(result.length, 0);
    });

    test("updates existing item", async () => {
      const result = await updateItem({
        ticker: "BTC",
        name: "Bitcoin",
        launched: 2009,
      });
      assert.strictEqual(result.length, 1);
    });
  });
});
