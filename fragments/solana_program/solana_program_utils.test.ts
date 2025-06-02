import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getInstructionDiscriminator, getPda } from "./solana_program_utils";
import { address } from "@solana/kit";

describe("solana program utils", () => {
  test("getInstructionDiscriminator succeeds", () => {
    const discriminator = getInstructionDiscriminator("initialize", "counter");
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

  test("getPda returns correct program derived address (PDA)", async () => {
    const userAddress = address("71jvqeEzwVnz6dpo2gZAKbCZkq6q6bpt9nkHZvBiia4Z");
    const programAddress = address("23Ww1C2uzCiH9zjmfhG6QmkopkeanZM87mjDHu8MMwXY");
    const pda = await getPda(userAddress, programAddress, "counter");
    assert.strictEqual(pda, "9yFnCu3Nyr4aa7kdd4ckAyPKABQyTPLX2Xm4Aj2MXsLc");
  });
});
