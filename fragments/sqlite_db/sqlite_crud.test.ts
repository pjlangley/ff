import { addItem, deleteItem, getAllItems, getItemByTicker, getItemsAfterLaunchYear, updateItem } from "./sqlite_crud";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("sqlite crud", () => {
  describe("getting by ticker", () => {
    test("retrieves a known ticker", async () => {
      const result = await getItemByTicker("BTC");
      assert.strictEqual(result!.ticker, "BTC");
      assert.strictEqual(result!.name, "Bitcoin");
      assert.strictEqual(result!.launched, 2009);
    });

    test("handles an unknown ticker", async () => {
      const result = await getItemByTicker("XRP");
      assert.strictEqual(result, undefined);
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

  describe("updating items", () => {
    test("updates existing item", async () => {
      const result = await updateItem({
        ticker: "BTC",
        name: "Bitcoin",
        launched: 2009,
      });
      assert.strictEqual(result!.ticker, "BTC");
    });

    test("updates nonexistent item", async () => {
      const result = await updateItem({
        ticker: "XRP",
        name: "Ripple",
        launched: 2012,
      });
      assert.strictEqual(result, undefined);
    });
  });

  describe("deleting items", () => {
    test("deletes existing item", async () => {
      const result = await deleteItem("BTC");
      assert.strictEqual(result!.ticker, "BTC");
    });

    test("deletes nonexistent item", async () => {
      const result = await deleteItem("XRP");
      assert.strictEqual(result, undefined);
    });
  });
});
