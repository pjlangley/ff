import { build } from "../app";
import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { randomUUID } from "node:crypto";

const api = build();

describe("fastify redis api", () => {
  after(() => {
    api.close();
  });

  describe("GET /redis/ping", () => {
    test("should return PONG message", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/redis/ping",
      });

      assert.strictEqual(response.statusCode, 200);
      const result = JSON.parse(response.payload);
      assert.strictEqual(result.message, "PONG");
    });
  });

  describe("GET /redis/favourites/:namespace", () => {
    test("should return a favourite coin for existing namespace", async () => {
      const namespace = randomUUID();

      await api.inject({
        method: "PUT",
        url: `/redis/favourites/${namespace}`,
        payload: {
          favouriteCoin: "BTC",
        },
      });

      const response = await api.inject({
        method: "GET",
        url: `/redis/favourites/${namespace}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const result = JSON.parse(response.payload);
      assert.strictEqual(result.favouriteCoin, "BTC");
    });

    test("returns 404 for non-existent namespace", async () => {
      const response = await api.inject({
        method: "GET",
        url: `/redis/favourites/${randomUUID()}`,
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe("PUT /redis/favourites/:namespace", () => {
    test("fails on invalid payload", async () => {
      const namespace = randomUUID();
      const response = await api.inject({
        method: "PUT",
        url: `/redis/favourites/${namespace}`,
        payload: {
          invalidField: "SOL",
        },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    test("fails on missing payload", async () => {
      const namespace = randomUUID();
      const response = await api.inject({
        method: "PUT",
        url: `/redis/favourites/${namespace}`,
        payload: {},
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe("PATCH /redis/favourites/:namespace", () => {
    test("updates an existing favourite coin", async () => {
      const namespace = randomUUID();

      const createResponse = await api.inject({
        method: "PUT",
        url: `/redis/favourites/${namespace}`,
        payload: {
          favouriteCoin: "SOL",
        },
      });
      assert.strictEqual(createResponse.statusCode, 200);

      const updateResponse = await api.inject({
        method: "PATCH",
        url: `/redis/favourites/${namespace}`,
        payload: {
          favouriteCoin: "BTC",
        },
      });
      assert.strictEqual(updateResponse.statusCode, 200);

      const getResponse = await api.inject({
        method: "GET",
        url: `/redis/favourites/${namespace}`,
      });
      const favourite = JSON.parse(getResponse.payload);
      assert.strictEqual(favourite.favouriteCoin, "BTC");
    });

    test("can update non-existent namespace (creates it)", async () => {
      const namespace = randomUUID();
      const response = await api.inject({
        method: "PATCH",
        url: `/redis/favourites/${namespace}`,
        payload: {
          favouriteCoin: "BTC",
        },
      });

      assert.strictEqual(response.statusCode, 200);

      const getResponse = await api.inject({
        method: "GET",
        url: `/redis/favourites/${namespace}`,
      });
      const favourite = JSON.parse(getResponse.payload);
      assert.strictEqual(favourite.favouriteCoin, "BTC");
    });

    test("fails on invalid payload", async () => {
      const namespace = randomUUID();
      const response = await api.inject({
        method: "PATCH",
        url: `/redis/favourites/${namespace}`,
        payload: {
          wrongField: "BTC",
        },
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe("DELETE /redis/favourites/:namespace", () => {
    test("deletes an existing favourite", async () => {
      const namespace = randomUUID();

      const createResponse = await api.inject({
        method: "PUT",
        url: `/redis/favourites/${namespace}`,
        payload: {
          favouriteCoin: "BTC",
        },
      });
      assert.strictEqual(createResponse.statusCode, 200);

      const deleteResponse = await api.inject({
        method: "DELETE",
        url: `/redis/favourites/${namespace}`,
      });
      assert.strictEqual(deleteResponse.statusCode, 204);

      const getResponse = await api.inject({
        method: "GET",
        url: `/redis/favourites/${namespace}`,
      });
      assert.strictEqual(getResponse.statusCode, 404);
    });

    test("deleting a non-existent namespace is idempotent", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: `/redis/favourites/${randomUUID()}`,
      });
      assert.strictEqual(response.statusCode, 204);
    });
  });
});
