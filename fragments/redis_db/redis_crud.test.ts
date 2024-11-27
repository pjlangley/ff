import { redisCreate, redisDelete, redisPing, redisRead, redisUpdate } from "./redis_crud";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

describe("redis crud", () => {
  test("ping returns pong", async () => {
    const result = await redisPing();
    assert.strictEqual(result, "PONG");
  });

  test("crud:create", async () => {
    const result = await redisCreate("nodejs", "BTC");
    assert.strictEqual(result, "OK");
  });

  test("crud:read", async () => {
    const result = await redisRead("nodejs");
    assert.strictEqual(result.favouriteCoin, "BTC");
  });

  test("crud:update", async () => {
    const result = await redisUpdate("nodejs", "PEPE");
    assert.strictEqual(result, "OK");

    const readResult = await redisRead("nodejs");
    assert.strictEqual(readResult.favouriteCoin, "PEPE");
  });

  test("crud:delete", async () => {
    const result = await redisDelete("nodejs");
    assert.strictEqual(result, "OK");

    const readResult = await redisRead("nodejs");
    assert.strictEqual(readResult.favouriteCoin, undefined);
  });
});
