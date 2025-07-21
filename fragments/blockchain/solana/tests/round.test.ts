import assert from "node:assert/strict";
import test, { before, beforeEach, describe } from "node:test";
import { Buffer } from "node:buffer";
import { LiteSVM } from "litesvm";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { Round } from "../target/types/round";
import { AnchorError, Program } from "@coral-xyz/anchor";
import idl from "../target/idl/round.json";
import BN from "bn.js";

const getRoundAccountPda = (authority: Keypair, programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("round"), authority.publicKey.toBuffer()],
    programId,
  )[0];
};

const initialiseRoundInstr = (program: Program<Round>, keypair: Keypair) => async (startSlot: bigint) => {
  await program.methods.initialiseRound(new BN(startSlot))
    .accounts({
      authority: keypair.publicKey,
    })
    .signers([keypair])
    .rpc();
};

const activateRoundInstr = (program: Program<Round>) => async (keypair: Keypair, pda: PublicKey) => {
  await program.methods.activateRound()
    .accounts({
      user: keypair.publicKey,
      // @ts-expect-error: account names not being recognised correctly ¯\_(ツ)_/¯
      round: pda,
    })
    .signers([keypair])
    .rpc();
};

const completeRoundInstr = (program: Program<Round>) => async (keypair: Keypair, pda: PublicKey) => {
  await program.methods.completeRound()
    .accounts({
      authority: keypair.publicKey,
      round: pda,
    })
    .signers([keypair])
    .rpc();
};

describe("program: round", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<Round>;
  let programId: PublicKey;
  let keypair: Keypair;
  let roundAccountPda: PublicKey;
  let initialiseRound: ReturnType<typeof initialiseRoundInstr>;
  let activateRound: ReturnType<typeof activateRoundInstr>;
  let completeRound: ReturnType<typeof completeRoundInstr>;

  before(() => {
    svm = fromWorkspace("./");
    provider = new LiteSVMProvider(svm);
    program = new Program<Round>(idl, provider);
    programId = new PublicKey(idl.address);
  });

  beforeEach(() => {
    keypair = new Keypair();
    roundAccountPda = getRoundAccountPda(keypair, programId);
    svm.airdrop(keypair.publicKey, BigInt(LAMPORTS_PER_SOL));
    initialiseRound = initialiseRoundInstr(program, keypair);
    activateRound = activateRoundInstr(program);
    completeRound = completeRoundInstr(program);
  });

  describe("round initialisation", () => {
    test("initialises a round", async () => {
      await initialiseRound(svm.getClock().slot + BigInt(10));

      const roundAccount = await program.account.round.fetch(roundAccountPda);
      assert.strictEqual(roundAccount.authority.toBase58(), keypair.publicKey.toBase58());
      assert.ok(roundAccount.startSlot.eqn(10));
    });

    test("fails to initialise a round if already initialised", async () => {
      await initialiseRound(svm.getClock().slot + BigInt(10));

      try {
        await initialiseRound(svm.getClock().slot + BigInt(20));
        assert.fail("Expected round initialisation to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*account.*already in use.*/);
      }
    });

    test("fails to initialise a round if not after current slot", async () => {
      svm.warpToSlot(BigInt(20));

      try {
        await initialiseRound(BigInt(10));
        assert.fail("Expected round initialisation to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /start slot must be greater than the current slot/);
      }
    });
  });

  describe("round activation", () => {
    test("authority user activates a round at start slot", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);
      await activateRound(keypair, roundAccountPda);

      const roundAccount = await program.account.round.fetch(roundAccountPda);
      assert.strictEqual(roundAccount.activatedBy!.toBase58(), keypair.publicKey.toBase58());
      assert.ok(roundAccount.activatedAt!.eqn(Number(startSlot)));
    });

    test("non-authority user activates a round at start slot", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);

      const activator = new Keypair();
      svm.airdrop(activator.publicKey, BigInt(LAMPORTS_PER_SOL));

      await activateRound(activator, roundAccountPda);

      const roundAccount = await program.account.round.fetch(roundAccountPda);
      assert.strictEqual(roundAccount.activatedBy!.toBase58(), activator.publicKey.toBase58());
      assert.ok(roundAccount.activatedAt!.eqn(Number(startSlot)));
    });

    test("round activated AFTER start slot", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      const activateAt = startSlot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(activateAt);
      await activateRound(keypair, roundAccountPda);

      const roundAccount = await program.account.round.fetch(roundAccountPda);
      assert.ok(roundAccount.activatedAt!.eqn(Number(activateAt)));
    });

    test("fails to activate a round if not initialised", async () => {
      try {
        await activateRound(keypair, roundAccountPda);
        assert.fail("Expected round activation to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*program expected this account to be already initialized.*/);
      }
    });

    test("fails to activiate a round if already active", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);
      await activateRound(keypair, roundAccountPda);

      try {
        await activateRound(keypair, roundAccountPda);
        assert.fail("Expected round activation to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*resulted in an error.*/);
      }
    });

    test("fails to activate a round if not after current slot", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(svm.getClock().slot + BigInt(5));

      try {
        await activateRound(keypair, roundAccountPda);
        assert.fail("Expected round activation to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*current slot must be greater than or equal to the start slot.*/);
      }
    });
  });

  describe("round completion", () => {
    test("completes a round", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      const completeSlot = startSlot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);
      await activateRound(keypair, roundAccountPda);
      svm.warpToSlot(completeSlot);
      await completeRound(keypair, roundAccountPda);

      const roundAccount = await program.account.round.fetch(roundAccountPda);
      assert.ok(roundAccount.completedAt!.eqn(Number(completeSlot)));
    });

    test("fails to complete a round if signer is not authority", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      const completeSlot = startSlot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);
      await activateRound(keypair, roundAccountPda);
      svm.warpToSlot(completeSlot);

      try {
        const nonAuthority = new Keypair();
        svm.airdrop(nonAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));
        await completeRound(nonAuthority, roundAccountPda);
        assert.fail("Expected round completion to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*constraint was violated.*/);
      }
    });

    test("fails to complete a round if not active", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      await initialiseRound(startSlot);

      try {
        await completeRound(keypair, roundAccountPda);
        assert.fail("Expected round completion to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*round has not yet been activated.*/);
      }
    });

    test("fails to complete a round if already completed", async () => {
      const startSlot = svm.getClock().slot + BigInt(10);
      const completeSlot = startSlot + BigInt(10);
      await initialiseRound(startSlot);
      svm.warpToSlot(startSlot);
      await activateRound(keypair, roundAccountPda);
      svm.warpToSlot(completeSlot);
      await completeRound(keypair, roundAccountPda);

      try {
        await completeRound(keypair, roundAccountPda);
        assert.fail("Expected round completion to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*resulted in an error.*/);
      }
    });

    test("fails to complete a round if not initialised", async () => {
      try {
        await completeRound(keypair, roundAccountPda);
        assert.fail("Expected round completion to fail");
      } catch (error) {
        const anchorError = error as AnchorError;
        assert.match(anchorError.message, /.*program expected this account to be already initialized.*/);
      }
    });
  });
});
