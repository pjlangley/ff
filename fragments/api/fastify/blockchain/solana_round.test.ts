import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { build } from "../app";
import { waitForSlot } from "../../../solana_rpc/solana_rpc_utils";

const api = build();

describe("Solana round API", () => {
  after(async () => {
    await api.close();
  });

  test("POST /solana/round/initialise - initialises a new round", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/solana/round/initialise",
    });

    assert.strictEqual(response.statusCode, 200);
    const res = response.json();
    assert.ok(res.address);
    assert.ok(res.startSlot);
  });

  test("GET /solana/round/:address - fetches PENDING round info", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/round/initialise",
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/round/${initBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.ok(getRes.startSlot);
    assert.ok(getRes.authority);
    assert.strictEqual(getRes.activatedAt, null);
    assert.strictEqual(getRes.activatedBy, null);
    assert.strictEqual(getRes.completedAt, null);
  });

  test("PATCH /solana/round/:address/activate - activates a round", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/round/initialise",
    });

    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const atSlot = await waitForSlot(BigInt(initBody.startSlot));
    if (!atSlot) {
      assert.fail(`Round start slot ${initBody.startSlot} not reached within timeout`);
    }

    const patchResponse = await api.inject({
      method: "PATCH",
      url: `/solana/round/${initBody.address}/activate`,
    });
    assert.strictEqual(patchResponse.statusCode, 200);

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/round/${initBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.ok(getRes.startSlot);
    assert.ok(getRes.authority);
    assert.ok(getRes.activatedAt);
    assert.ok(getRes.activatedBy);
    assert.strictEqual(getRes.completedAt, null);
  });

  test("PATCH /solana/round/:address/complete - completes a round", async () => {
    const initResponse = await api.inject({
      method: "POST",
      url: "/solana/round/initialise",
    });
    assert.strictEqual(initResponse.statusCode, 200);
    const initBody = initResponse.json();

    const atSlot = await waitForSlot(BigInt(initBody.startSlot));
    if (!atSlot) {
      assert.fail(`Round start slot ${initBody.startSlot} not reached within timeout`);
    }

    const activateResponse = await api.inject({
      method: "PATCH",
      url: `/solana/round/${initBody.address}/activate`,
    });
    assert.strictEqual(activateResponse.statusCode, 200);

    const patchResponse = await api.inject({
      method: "PATCH",
      url: `/solana/round/${initBody.address}/complete`,
    });
    assert.strictEqual(patchResponse.statusCode, 200);

    const getResponse = await api.inject({
      method: "GET",
      url: `/solana/round/${initBody.address}`,
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const getRes = getResponse.json();
    assert.ok(getRes.startSlot);
    assert.ok(getRes.authority);
    assert.ok(getRes.activatedAt);
    assert.ok(getRes.activatedBy);
    assert.ok(getRes.completedAt);
  });

  test("GET /solana/round/:address - returns 404 for non-existent round", async () => {
    const response = await api.inject({
      method: "GET",
      url: `/solana/round/11111111111111111111111111111111`,
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
