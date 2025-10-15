import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { build } from "../app";

const api = build();

describe("Solana username API", () => {
  after(async () => {
    await api.close();
  });

  test("POST /solana/username/initialise - initialises a new username", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/username/initialise",
      body: { username: "alice" },
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.address);
  });

  test("GET /solana/username/:address - fetches username", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/username/initialise",
      body: { username: "alice" },
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/username/${initBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.strictEqual(getRes.username, "alice");
  });

  test("GET /solana/username/:address - returns 404 for non-existent address", async () => {
    const response = await api.inject({
      method: "GET",
      url: `/solana/username/11111111111111111111111111111111`,
    });

    assert.strictEqual(response.statusCode, 404);
  });

  test("PATCH /solana/username/:address - updates username", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/username/initialise",
      body: { username: "alice" },
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const patchResponse = await api.inject({
      method: "PATCH",
      url: `/solana/username/${initBody.address}`,
      body: { username: "bob" },
    });

    assert.strictEqual(patchResponse.statusCode, 200);

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/username/${initBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.strictEqual(getRes.username, "bob");
  });

  test("PATCH /solana/username/:address - returns 404 for non-existent address", async () => {
    const response = await api.inject({
      method: "PATCH",
      url: `/solana/username/11111111111111111111111111111111`,
      body: { username: "alice" },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  test("GET /solana/username/:address/record/:changeIndex - fetches username change record", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/username/initialise",
      body: { username: "alice" },
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const patchResponse = await api.inject({
      method: "PATCH",
      url: `/solana/username/${initBody.address}`,
      body: { username: "bob" },
    });

    assert.strictEqual(patchResponse.statusCode, 200);

    const recordResponse = await api.inject({
      method: "GET",
      url: `/solana/username/${initBody.address}/record/0`,
    });

    assert.strictEqual(recordResponse.statusCode, 200);
    const recordRes = recordResponse.json();
    assert.strictEqual(recordRes.oldUsername, "alice");
    assert.strictEqual(recordRes.changeIndex, "0");
    assert.strictEqual(recordRes.authority, initBody.address);
  });

  test("GET /solana/username/:address/record/:changeIndex - returns 404 for non-existent address", async () => {
    const response = await api.inject({
      method: "GET",
      url: `/solana/username/11111111111111111111111111111111/record/0`,
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
