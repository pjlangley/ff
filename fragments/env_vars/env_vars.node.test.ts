import { get_env_var } from "./env_vars.node";
import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { env } from 'node:process';

describe('env_vars', () => {
  test('returns environment variable value if exists', () => {
    env.REPO_NAME = 'testing_123';
    assert.strictEqual(get_env_var('REPO_NAME'), 'testing_123')
    delete env.REPO_NAME;
  });

  test('returns "undefined" if nonexistent', () => {
    assert.strictEqual(get_env_var('REPO_NAME'), undefined);
  });
});
