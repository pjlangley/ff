import * as anchor from "@coral-xyz/anchor";
import { Counter } from "../target/types/counter";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import IDL from "../target/idl/counter.json";

describe("program: counter", () => {
  test("initializes and increments the counter", async () => {
    const PROGRAM_ID = new anchor.web3.PublicKey(IDL.address);
    const context = await startAnchor("", [{ name: "counter", programId: PROGRAM_ID }], []);
    const provider = new BankrunProvider(context);
    const payer = provider.wallet;
    const program = new anchor.Program<Counter>(IDL as Counter, provider);
    const counterKeypair = anchor.web3.Keypair.generate();

    await program.methods
      .initialize()
      .accounts({
        counter: counterKeypair.publicKey,
        user: payer.publicKey,
      })
      .signers([counterKeypair])
      .rpc();

    let currentCount = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.strictEqual(currentCount.count.toNumber(), 0);

    await program.methods
      .increment()
      .accounts({
        counter: counterKeypair.publicKey,
        user: payer.publicKey,
      })
      .rpc();

    currentCount = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.strictEqual(currentCount.count.toNumber(), 1);
  });

  test("fails to increment if initialize wasn't called", async () => {
    const PROGRAM_ID = new anchor.web3.PublicKey(IDL.address);
    const context = await startAnchor("", [{ name: "counter", programId: PROGRAM_ID }], []);
    const provider = new BankrunProvider(context);
    const payer = provider.wallet;
    const program = new anchor.Program<Counter>(IDL as Counter, provider);
    const counterKeypair = anchor.web3.Keypair.generate();

    try {
      await program.methods
        .increment()
        .accounts({
          counter: counterKeypair.publicKey,
          user: payer.publicKey,
        })
        .rpc();

      assert.fail("Expected transaction to fail, but it succeeded");
    } catch (err) {
      assert.ok(err, "Transaction failed as expected");
    }
  });
});
