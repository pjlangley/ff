import assert from "node:assert/strict";
import test, { after, describe } from "node:test";
import { build } from "../app";

const api = build();

describe("Solana balance API", () => {
  after(async () => {
    await api.close();
  });

  describe("GET /solana/balance/:address", () => {
    test("valid address with zero balance", async () => {
      const response = await api.inject({
        method: "GET",
        url: `/solana/balance/111111111111111111111111111111aa`,
      });

      assert.strictEqual(response.statusCode, 200);
      const res = response.json();
      assert.strictEqual(res.balance, "0");
    });

    test("invalid address returns 400", async () => {
      const response = await api.inject({
        method: "GET",
        url: `/solana/balance/22222222222222222222222222222222`,
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });
});
