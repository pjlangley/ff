import { get_env_var } from "./env_vars_utils.deno.ts";
import { assertEquals } from "std/assert/mod.ts";

Deno.test("returns environment variable value if exists", () => {
  Deno.env.set("REPO_NAME", "testing_123");

  assertEquals(get_env_var("REPO_NAME"), "testing_123");

  Deno.env.delete("REPO_NAME");
});

Deno.test('returns "undefined" if nonexistent', () => {
  const old_env_value = Deno.env.get("REPO_NAME");
  Deno.env.delete("REPO_NAME");

  assertEquals(get_env_var("REPO_NAME"), undefined);

  if (old_env_value) {
    Deno.env.set("REPO_NAME", old_env_value);
  }
});
