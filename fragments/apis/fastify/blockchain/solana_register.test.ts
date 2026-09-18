import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { build } from "../app";

const api = build();

describe("Solana register API", () => {
  after(async () => {
    await api.close();
  });

  test("POST /solana/register/initialise - initialises the registry", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/register/initialise",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.authority);
  });

  test("POST /solana/register/initialise - is idempotent", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/register/initialise",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.authority);
  });

  test("POST /solana/register/register - registers a new registrant", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/register/register",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.address);
  });

  test("GET /solana/register/registry - fetches registry state", async () => {
    const response = await api.inject({
      method: "GET",
      url: "/solana/register/registry",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.authority);
    assert.ok(res.registration_count);
    assert.ok(Number(res.registration_count) >= 0);
  });

  test("GET /solana/register/:address - fetches unconfirmed registration", async () => {
    const registerResponse = await api.inject({
      method: "POST",
      url: "/solana/register/register",
    });

    assert.strictEqual(registerResponse.statusCode, 200);
    const registerBody = registerResponse.json();

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/register/${registerBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.ok(getRes.registrant);
    assert.ok(getRes.registration_index);
    assert.ok(getRes.registered_at);
    assert.strictEqual(getRes.confirmed_at, null);

    // The same registration reached by index rather than by address.
    const byIndexResponse = await api.inject({
      method: "GET",
      url: `/solana/register/index/${getRes.registration_index}`,
    });

    assert.strictEqual(byIndexResponse.statusCode, 200);
    assert.deepStrictEqual(byIndexResponse.json(), getRes);
  });

  test("GET /solana/register/index/:index - returns 404 for an index nothing has reached", async () => {
    const response = await api.inject({
      method: "GET",
      url: "/solana/register/index/9223372036854775808",
    });

    assert.strictEqual(response.statusCode, 404);
  });

  test("GET /solana/register/index/:index - returns 400 for a malformed index", async () => {
    for (const index of ["abc", "-1", "1.5", "18446744073709551616"]) {
      const response = await api.inject({
        method: "GET",
        url: `/solana/register/index/${index}`,
      });

      assert.strictEqual(response.statusCode, 400, `expected 400 for index ${index}`);
    }
  });

  test("PATCH /solana/register/:address/confirm - confirms a registration", async () => {
    const registerResponse = await api.inject({
      method: "POST",
      url: "/solana/register/register",
    });

    assert.strictEqual(registerResponse.statusCode, 200);
    const registerBody = registerResponse.json();

    const confirmResponse = await api.inject({
      method: "PATCH",
      url: `/solana/register/${registerBody.address}/confirm`,
    });

    assert.strictEqual(confirmResponse.statusCode, 200);

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/register/${registerBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.ok(getRes.confirmed_at);
  });

  test("GET /solana/register/:address - returns 404 for unknown address", async () => {
    const response = await api.inject({
      method: "GET",
      url: "/solana/register/11111111111111111111111111111111",
    });

    assert.strictEqual(response.statusCode, 404);
  });

  test("PATCH /solana/register/:address/confirm - returns 404 for unknown address", async () => {
    const response = await api.inject({
      method: "PATCH",
      url: "/solana/register/11111111111111111111111111111111/confirm",
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
