import * as anchor from "@coral-xyz/anchor";
import { Counter } from "../target/types/counter";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import IDL from "../target/idl/counter.json";
import { Buffer } from "node:buffer";

describe("program: counter", () => {
  test("initializes and increments the counter", async () => {
    const PROGRAM_ID = new anchor.web3.PublicKey(IDL.address);
    const context = await startAnchor("", [{ name: "counter", programId: PROGRAM_ID }], []);
    const provider = new BankrunProvider(context);
    const payer = provider.wallet;
    const program = new anchor.Program<Counter>(IDL as Counter, provider);
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), payer.publicKey.toBuffer()],
      PROGRAM_ID,
    );

    await program.methods
      .initialize()
      .accounts({
        user: payer.publicKey,
      })
      .rpc();

    let currentCount = await program.account.counter.fetch(counterPda);
    assert.strictEqual(currentCount.count.toNumber(), 0);

    await program.methods
      .increment()
      .accounts({
        counter: counterPda,
        user: payer.publicKey,
      })
      .rpc();

    currentCount = await program.account.counter.fetch(counterPda);
    assert.strictEqual(currentCount.count.toNumber(), 1);
  });

  test("fails to increment if initialize wasn't called", async () => {
    const PROGRAM_ID = new anchor.web3.PublicKey(IDL.address);
    const context = await startAnchor("", [{ name: "counter", programId: PROGRAM_ID }], []);
    const provider = new BankrunProvider(context);
    const payer = provider.wallet;
    const program = new anchor.Program<Counter>(IDL as Counter, provider);
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), payer.publicKey.toBuffer()],
      PROGRAM_ID,
    );

    try {
      await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          user: payer.publicKey,
        })
        .rpc();

      assert.fail("Expected transaction to fail, but it succeeded");
    } catch (err) {
      assert.ok(err, "Transaction failed as expected");
    }
  });
});
