import { addItem, deleteItem, getAllItems, getItemByTicker, getItemsAfterLaunchYear, updateItem } from "./sqlite_crud";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { randomUUID } from "node:crypto";

describe("sqlite crud", () => {
  describe("getting by ticker", () => {
    test("retrieves a known ticker", () => {
      const result = getItemByTicker("BTC");
      assert.strictEqual(result!.ticker, "BTC");
      assert.strictEqual(result!.name, "Bitcoin");
      assert.strictEqual(result!.launched, 2009);
    });

    test("handles an unknown ticker", () => {
      const result = getItemByTicker(randomUUID().slice(0, 6).toUpperCase());
      assert.strictEqual(result, undefined);
    });
  });

  describe("get items after launch year", () => {
    test("matching items after launch year", () => {
      const result = getItemsAfterLaunchYear(2000);
      assert.ok(result.length >= 3);
    });

    test("no matching items after launch year", () => {
      const result = getItemsAfterLaunchYear(2050);
      assert.strictEqual(result.length, 0);
    });
  });

  test("get all items ordered by launch year", () => {
    const result = getAllItems();
    assert.ok(result.length >= 3);
  });

  describe("adding items", () => {
    test("adds an item to the database table", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = addItem({
        ticker,
        name: "Test Coin",
        launched: 2023,
      });
      assert.strictEqual(result, "ok");

      const item = getItemByTicker(ticker);
      assert.strictEqual(item!.ticker, ticker);
    });

    test("handles duplicates", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      addItem({
        ticker,
        name: "Test Coin",
        launched: 2023,
      });

      const result = addItem({
        ticker,
        name: "Test Coin Duplicate",
        launched: 2024,
      });
      assert.strictEqual(result, "ok");

      const item = getItemByTicker(ticker);
      assert.strictEqual(item!.name, "Test Coin");
      assert.strictEqual(item!.launched, 2023);
    });
  });

  describe("updating items", () => {
    test("updates existing item", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      addItem({
        ticker,
        name: "Original Name",
        launched: 2023,
      });

      const result = updateItem({
        ticker,
        name: "Updated Name",
        launched: 2024,
      });
      assert.strictEqual(result!.ticker, ticker);
      assert.strictEqual(result!.name, "Updated Name");
      assert.strictEqual(result!.launched, 2024);
    });

    test("updates nonexistent item", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = updateItem({
        ticker,
        name: "Nonexistent",
        launched: 2012,
      });
      assert.strictEqual(result, undefined);
    });
  });

  describe("deleting items", () => {
    test("deletes existing item", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      addItem({
        ticker,
        name: "To Be Deleted",
        launched: 2024,
      });

      const result = deleteItem(ticker);
      assert.strictEqual(result!.ticker, ticker);

      const check = getItemByTicker(ticker);
      assert.strictEqual(check, undefined);
    });

    test("deletes nonexistent item", () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const result = deleteItem(ticker);
      assert.strictEqual(result, undefined);
    });
  });
});
