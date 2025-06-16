import assert from "node:assert/strict";
import test, { before, beforeEach, describe } from "node:test";
import { Buffer } from "node:buffer";
import { LiteSVM } from "litesvm";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { Username } from "../target/types/username";
import { AnchorError, Program } from "@coral-xyz/anchor";
import idl from "../target/idl/username.json";

const getUserAccountPda = (payer: Keypair, programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_account"), payer.publicKey.toBuffer()],
    programId,
  )[0];
};

const getUserRecordAccountPda = (payer: Keypair, programId: PublicKey, changeCount: bigint) => {
  const changeCountBuffer = Buffer.alloc(8);
  changeCountBuffer.writeBigInt64LE(changeCount);

  return PublicKey.findProgramAddressSync(
    [Buffer.from("username_record"), payer.publicKey.toBuffer(), changeCountBuffer],
    programId,
  )[0];
};

const initializeUsernameInstr = (program: Program<Username>, keypair: Keypair) => async (username: string) => {
  await program.methods.initializeUsername({ value: username })
    .accounts({
      authority: keypair.publicKey,
    })
    .signers([keypair])
    .rpc();
};

const updateUsernameInstr = (program: Program<Username>, programId: PublicKey, keypair: Keypair) =>
async (
  username: string,
  userRecordPda: PublicKey,
) => {
  const userAccountPda = getUserAccountPda(keypair, programId);
  await program.methods.updateUsername({ value: username })
    .accounts({
      // @ts-expect-error: account names not being recognised correctly ¯\_(ツ)_/¯
      authority: keypair.publicKey,
      userAccount: userAccountPda,
      usernameRecord: userRecordPda,
    })
    .signers([keypair])
    .rpc();
};

describe("program: username", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<Username>;
  let programId: PublicKey;
  let keypair: Keypair;
  let userAccountPda: PublicKey;
  let initializeUsername: ReturnType<typeof initializeUsernameInstr>;
  let updateUsername: ReturnType<typeof updateUsernameInstr>;

  before(() => {
    svm = fromWorkspace("./");
    provider = new LiteSVMProvider(svm);
    program = new Program<Username>(idl, provider);
    programId = new PublicKey(idl.address);
  });

  beforeEach(() => {
    keypair = new Keypair();
    userAccountPda = getUserAccountPda(keypair, programId);
    svm.airdrop(keypair.publicKey, BigInt(LAMPORTS_PER_SOL));
    initializeUsername = initializeUsernameInstr(program, keypair);
    updateUsername = updateUsernameInstr(program, programId, keypair);
  });

  test("initializes a valid username", async () => {
    await initializeUsername("-My_Username_123-");
    const userAccount = await program.account.userAccount.fetch(userAccountPda);

    assert.strictEqual(userAccount.username.value, "-My_Username_123-");
    assert.strictEqual(userAccount.changeCount.toNumber(), 0);
    assert.strictEqual(userAccount.usernameRecentHistory.length, 0);
  });

  test("updates a valid username", async () => {
    const userRecordAccountPda = getUserRecordAccountPda(keypair, programId, BigInt(0));

    await initializeUsername("my_username");
    let userAccount = await program.account.userAccount.fetch(userAccountPda);
    assert.strictEqual(userAccount.username.value, "my_username");

    await updateUsername("my_new_username", userRecordAccountPda);
    userAccount = await program.account.userAccount.fetch(userAccountPda);
    assert.strictEqual(userAccount.username.value, "my_new_username");
    assert.strictEqual(userAccount.changeCount.toNumber(), 1);
    assert.strictEqual(userAccount.usernameRecentHistory.length, 1);
    assert.strictEqual(userAccount.usernameRecentHistory[0].value, "my_username");

    const userRecordAccount = await program.account.usernameRecord.fetch(userRecordAccountPda);
    assert.strictEqual(userRecordAccount.oldUsername.value, "my_username");
    assert.strictEqual(userRecordAccount.changeIndex.toNumber(), 0);
  });

  test("multiple username updates are tracked in the recent username change history", async () => {
    await initializeUsername("username0");

    for (let i = 0; i <= 3; i++) {
      await updateUsername(
        `username${i + 1}`,
        getUserRecordAccountPda(keypair, programId, BigInt(i)),
      );
    }

    const userAccount = await program.account.userAccount.fetch(userAccountPda);
    assert.strictEqual(userAccount.username.value, "username4");
    assert.strictEqual(userAccount.changeCount.toNumber(), 4);
    assert.strictEqual(userAccount.usernameRecentHistory.length, 3);
    assert.strictEqual(userAccount.usernameRecentHistory[0].value, "username1");
    assert.strictEqual(userAccount.usernameRecentHistory[1].value, "username2");
    assert.strictEqual(userAccount.usernameRecentHistory[2].value, "username3");
  });

  test("multiple username updates are tracked in archived username record history", async () => {
    await initializeUsername("username0");

    for (let i = 0; i <= 3; i++) {
      await updateUsername(
        `username${i + 1}`,
        getUserRecordAccountPda(keypair, programId, BigInt(i)),
      );
    }

    for (let i = 0; i <= 3; i++) {
      const userRecordAccountPda = getUserRecordAccountPda(keypair, programId, BigInt(i));
      const userRecordAccount = await program.account.usernameRecord.fetch(userRecordAccountPda);
      assert.strictEqual(userRecordAccount.oldUsername.value, `username${i}`);
      assert.strictEqual(userRecordAccount.changeIndex.toNumber(), i);
    }
  });

  describe("username validation during initialization", () => {
    test("username too long", async () => {
      try {
        await initializeUsername(Array(33).fill("a").join(""));
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameTooLong"),
        );
        assert.ok(
          anchorError.message.includes("maximum length is 32 characters"),
        );
      }
    });

    test("username too short", async () => {
      try {
        await initializeUsername("a");
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameTooShort"),
        );
        assert.ok(
          anchorError.message.includes("minimum length is 2 characters"),
        );
      }
    });

    test("username contains invalid characters", async () => {
      try {
        await initializeUsername("abc123@@@");
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameInvalidCharacters"),
        );
        assert.ok(
          anchorError.message.includes("only ascii alphanumeric, underscores, and hyphens are allowed"),
        );
      }
    });
  });

  describe("username validation during update", () => {
    beforeEach(async () => {
      await initializeUsername("my_username");
    });

    test("username too long", async () => {
      try {
        await updateUsername(
          Array(33).fill("a").join(""),
          getUserRecordAccountPda(keypair, programId, BigInt(0)),
        );
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameTooLong"),
        );
        assert.ok(
          anchorError.message.includes("maximum length is 32 characters"),
        );
      }
    });

    test("username too short", async () => {
      try {
        await updateUsername(
          "a",
          getUserRecordAccountPda(keypair, programId, BigInt(0)),
        );
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameTooShort"),
        );
        assert.ok(
          anchorError.message.includes("minimum length is 2 characters"),
        );
      }
    });

    test("username contains invalid characters", async () => {
      try {
        await updateUsername(
          "abc123@@@",
          getUserRecordAccountPda(keypair, programId, BigInt(0)),
        );
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.ok(
          anchorError.message.includes("UsernameInvalidCharacters"),
        );
        assert.ok(
          anchorError.message.includes("only ascii alphanumeric, underscores, and hyphens are allowed"),
        );
      }
    });
  });

  test("fails to update if the username is already assigned", async () => {
    await initializeUsername("my_username");

    try {
      await updateUsername(
        "my_username",
        getUserRecordAccountPda(keypair, programId, BigInt(0)),
      );
      assert.fail("Expected transaction to fail, got success");
    } catch (err) {
      const anchorError = err as AnchorError;
      assert.ok(
        anchorError.message.includes("UsernameAlreadyAssigned"),
      );
      assert.ok(
        anchorError.message.includes("Username is already assigned"),
      );
    }
  });

  test("fails to update username with an incorrect username record account", async () => {
    await initializeUsername("my_username");

    try {
      await updateUsername(
        "my_username",
        getUserRecordAccountPda(keypair, programId, BigInt(1)),
      );
      assert.fail("Expected transaction to fail, got success");
    } catch (err) {
      const anchorError = err as AnchorError;
      assert.ok(
        anchorError.message.includes("ConstraintSeeds"),
      );
    }
  });

  test("fails to update username for a missing user account", async () => {
    try {
      await updateUsername(
        "abc123",
        getUserRecordAccountPda(keypair, programId, BigInt(0)),
      );
      assert.fail("Expected transaction to fail, got success");
    } catch (err) {
      const anchorError = err as AnchorError;
      assert.ok(
        anchorError.message.includes("AccountNotInitialized"),
      );
    }
  });
});
