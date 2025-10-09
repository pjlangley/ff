import { build } from "../app";
import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { randomUUID } from "node:crypto";

const api = build();

describe("fastify sqlite api", () => {
  after(() => {
    api.close();
  });

  describe("GET /sqlite/coins", () => {
    test("should return a list of coins", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/sqlite/coins",
      });

      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.payload.length > 0);
    });
  });

  describe("GET /sqlite/coins/:ticker", () => {
    test("should return a specific coin by ticker", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/sqlite/coins/BTC",
      });

      assert.strictEqual(response.statusCode, 200);
      const coin = JSON.parse(response.payload);
      assert.strictEqual(coin.ticker, "BTC");
    });

    test("handles a lowercase ticker", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/sqlite/coins/btc",
      });

      assert.strictEqual(response.statusCode, 200);
      const coin = JSON.parse(response.payload);
      assert.strictEqual(coin.ticker, "BTC");
    });

    test("returns 404 for non-existent ticker", async () => {
      const response = await api.inject({
        method: "GET",
        url: `/sqlite/coins/${randomUUID().slice(0, 6).toUpperCase()}`,
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe("GET /sqlite/coins/after/:year", () => {
    test("should return coins launched after a specific year", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/sqlite/coins/after/2008",
      });

      assert.strictEqual(response.statusCode, 200);
      const coins = JSON.parse(response.payload);
      assert.ok(coins.length > 0);
      coins.forEach((coin: { launched: number }) => {
        assert.ok(coin.launched > 2008);
      });
    });

    test("returns empty array if no coins found after the year", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/sqlite/coins/after/2050",
      });

      assert.strictEqual(response.statusCode, 200);
      const coins = JSON.parse(response.payload);
      assert.ok(Array.isArray(coins));
      assert.strictEqual(coins.length, 0);
    });
  });

  describe("PUT /sqlite/coins/:ticker", () => {
    test("creates a new coin", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const response = await api.inject({
        method: "PUT",
        url: `/sqlite/coins/${ticker}`,
        payload: {
          name: "SQLite test coin",
          launched: 2025,
        },
      });

      assert.strictEqual(response.statusCode, 200);

      const getResponse = await api.inject({
        method: "GET",
        url: `/sqlite/coins/${ticker}`,
      });

      assert.strictEqual(getResponse.statusCode, 200);
      const coin = JSON.parse(getResponse.payload);
      assert.strictEqual(coin.ticker, ticker);
      assert.strictEqual(coin.name, "SQLite test coin");
      assert.strictEqual(coin.launched, 2025);
    });

    test("fails on invalid payload", async () => {
      const ticker = randomUUID().slice(0, 6).toUpperCase();
      const response = await api.inject({
        method: "PUT",
        url: `/sqlite/coins/${ticker}`,
        payload: {
          name: "Invalid coin",
        },
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe("DELETE /sqlite/coins/:ticker", () => {
    test("deletes an existing coin", async () => {
      const ticker = randomUUID().slice(0, 6);
      const createResponse = await api.inject({
        method: "PUT",
        url: `/sqlite/coins/${ticker}`,
        payload: {
          name: "Coin to be deleted",
          launched: 2025,
        },
      });
      assert.strictEqual(createResponse.statusCode, 200);

      const deleteResponse = await api.inject({
        method: "DELETE",
        url: `/sqlite/coins/${ticker}`,
      });
      assert.strictEqual(deleteResponse.statusCode, 204);

      const getResponse = await api.inject({
        method: "GET",
        url: `/sqlite/coins/${ticker}`,
      });
      assert.strictEqual(getResponse.statusCode, 404);
    });

    test("deleting a non-existent coin is idempotent", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: `/sqlite/coins/${randomUUID().slice(0, 6)}`,
      });
      assert.strictEqual(response.statusCode, 204);
    });
  });

  describe("PATCH /sqlite/coins/:ticker", () => {
    test("updates an existing coin", async () => {
      const ticker = randomUUID().slice(0, 6);
      const createResponse = await api.inject({
        method: "PUT",
        url: `/sqlite/coins/${ticker}`,
        payload: {
          name: "Coin to be updated",
          launched: 2025,
        },
      });
      assert.strictEqual(createResponse.statusCode, 200);

      const updateResponse = await api.inject({
        method: "PATCH",
        url: `/sqlite/coins/${ticker}`,
        payload: {
          name: "Updated coin name",
          launched: 2025,
        },
      });
      assert.strictEqual(updateResponse.statusCode, 200);
      const updatedCoin = JSON.parse(updateResponse.payload);
      assert.strictEqual(updatedCoin.name, "Updated coin name");
    });

    test("returns 404 when updating a non-existent coin", async () => {
      const response = await api.inject({
        method: "PATCH",
        url: `/sqlite/coins/${randomUUID().slice(0, 6)}`,
        payload: {
          name: "Non-existent coin",
          launched: 2025,
        },
      });
      assert.strictEqual(response.statusCode, 404);
    });
  });
});
