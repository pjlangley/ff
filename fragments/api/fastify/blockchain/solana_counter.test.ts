import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { build } from "../app";

const api = build();

describe("Solana Counter API", () => {
  after(async () => {
    await api.close();
  });

  test("GET /solana/counter/:address - returns 404 for non-existent counter", async () => {
    const response = await api.inject({
      method: "GET",
      url: `/solana/counter/11111111111111111111111111111111`,
    });

    assert.ok(response.statusCode === 404);
  });

  test("PATCH /solana/counter/:address/increment - returns 404 when counter not initialised", async () => {
    const response = await api.inject({
      method: "PATCH",
      url: "/solana/counter/11111111111111111111111111111111/increment",
    });

    assert.strictEqual(response.statusCode, 404);
  });

  test("POST /solana/counter/initialise - initialises a new counter", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/counter/initialise",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/counter/${res.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.strictEqual(BigInt(getRes.count), 0n, "Initial count should be 0");
  });

  test("PATCH /solana/counter/:address/increment - increments counter", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/counter/initialise",
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const incrementResponse = await api.inject({
      method: "PATCH",
      url: `/solana/counter/${initBody.address}/increment`,
    });

    assert.strictEqual(incrementResponse.statusCode, 200);
    const incrementBody = incrementResponse.json();

    assert.strictEqual(BigInt(incrementBody.newCount), 1n, "newCount should be 1");
  });
});
