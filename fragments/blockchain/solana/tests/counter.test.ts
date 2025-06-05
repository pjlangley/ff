import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import { Buffer } from "node:buffer";
import { LiteSVM } from "litesvm";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { Counter } from "../target/types/counter";
import { AnchorError, Program } from "@coral-xyz/anchor";
import idl from "../target/idl/counter.json";

const getCounterPda = (payer: Keypair, programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), payer.publicKey.toBuffer()],
    programId,
  )[0];
};

describe("program: counter", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<Counter>;
  let programId: PublicKey;

  before(() => {
    svm = fromWorkspace("./");
    provider = new LiteSVMProvider(svm);
    program = new Program<Counter>(idl, provider);
    programId = new PublicKey(idl.address);
  });

  test("initializes and increments the counter", async () => {
    const keypair = new Keypair();
    const counterPda = getCounterPda(keypair, programId);
    svm.airdrop(keypair.publicKey, BigInt(LAMPORTS_PER_SOL));

    await program.methods.initialize()
      .accounts({
        user: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    let currentCount = await program.account.counter.fetch(counterPda);
    assert.strictEqual(currentCount.count.toNumber(), 0);

    await program.methods.increment()
      .accounts({
        counter: counterPda,
        user: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    currentCount = await program.account.counter.fetch(counterPda);
    assert.strictEqual(currentCount.count.toNumber(), 1);
  });

  test("fails to increment if initialize wasn't called", async () => {
    const keypair = new Keypair();
    svm.airdrop(keypair.publicKey, BigInt(LAMPORTS_PER_SOL));
    const counterPda = getCounterPda(keypair, programId);

    try {
      await program.methods.increment()
        .accounts({
          counter: counterPda,
          user: keypair.publicKey,
        })
        .signers([keypair])
        .rpc();

      assert.fail("Expected transaction to fail, got success");
    } catch (err) {
      const anchorError = err as AnchorError;
      assert.ok(
        anchorError.message.includes("AccountNotInitialized"),
        "Error message should include 'AccountNotInitialized'",
      );
    }
  });

  test("fails to get account if it doesn't exist", async () => {
    const keypair = new Keypair();
    const counterPda = getCounterPda(keypair, programId);

    try {
      await program.account.counter.fetch(counterPda);
      assert.fail("Expected transaction to fail, got success");
    } catch (err) {
      const error = err as Error;
      assert.ok(
        error.message.includes(`Could not find ${counterPda}`),
        `Error message should include 'Could not find ${counterPda}'`,
      );
    }
  });
});
