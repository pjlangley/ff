import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getInstructionDiscriminator } from "./solana_program_utils";

describe("solana program utils", () => {
  test("getInstructionDiscriminator succeeds", () => {
    const discriminator = getInstructionDiscriminator("initialize", "counter");
    assert.strictEqual(discriminator.length, 8);
    assert.deepStrictEqual(
      discriminator,
      new Uint8Array([
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237,
      ]),
    );
  });

  test("getInstructionDiscriminator fails with invalid instruction", () => {
    assert.throws(() => {
      getInstructionDiscriminator("invalid", "counter");
    }, {
      name: "Error",
      message: "Instruction invalid not found in program counter IDL",
    });
  });
});
