import { getEnvVar } from "./env_vars_utils";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { env } from "node:process";

describe("env_vars", () => {
  test("returns environment variable value if exists", () => {
    env.REPO_NAME = "testing_123";
    assert.strictEqual(getEnvVar("REPO_NAME"), "testing_123");
    delete env.REPO_NAME;
  });

  test('returns "undefined" if nonexistent', () => {
    assert.strictEqual(getEnvVar("REPO_NAME"), undefined);
  });
});
