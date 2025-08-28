import {
  AccountRole,
  addDecoderSizePrefix,
  addEncoderSizePrefix,
  Address,
  appendTransactionMessageInstruction,
  assertAccountExists,
  Decoder,
  Encoder,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getArrayDecoder,
  getProgramDerivedAddress,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getUtf8Decoder,
  getUtf8Encoder,
  KeyPairSigner,
  offsetDecoder,
} from "@solana/kit";
import { getInstructionDiscriminator, getPda, skipAnchorDiscriminator } from "../solana_program/solana_program_utils";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { Buffer } from "node:buffer";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import {
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "../solana_transaction/solana_transaction_utils";

export const initializeUsername = async (
  keypair: KeyPairSigner,
  programAddress: Address,
  username: Username["value"],
) => {
  const discriminator = getInstructionDiscriminator("initialize_username", "username");
  const payer = keypair.address;
  const usernamePda = await getPda(payer, programAddress, "user_account");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer);

  // Avoid the readonly error due to type return of 'ReadonlyUint8Array'
  const encodedUsername = Buffer.from(usernameEncoder.encode({ value: username }));

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: Buffer.concat([discriminator, encodedUsername]),
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: usernamePda, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, keypair.keyPair);

  return sig;
};

export const getUsernameAccount = async (keypair: KeyPairSigner, programAddress: Address) => {
  const client = initRpcClient();
  const usernamePda = await getPda(keypair.address, programAddress, "user_account");
  const account = await fetchEncodedAccount(client, usernamePda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${usernamePda} does not exist`);
  }

  assertAccountExists(account);

  const decoded = usernameAccountDecoder.decode(account.data);

  return decoded;
};

export const updateUsername = async (keypair: KeyPairSigner, programAddress: Address, username: Username["value"]) => {
  const usernameAccount = await getUsernameAccount(keypair, programAddress);
  const changeCount = usernameAccount.change_count;
  const discriminator = getInstructionDiscriminator("update_username", "username");
  const payer = keypair.address;
  const usernamePda = await getPda(payer, programAddress, "user_account");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer);
  const usernameRecordPda = await getUsernameRecordAccountPda(payer, programAddress, changeCount);

  // Avoid the readonly error due to type return of 'ReadonlyUint8Array'
  const encodedUsername = Buffer.from(usernameEncoder.encode({ value: username }));

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: Buffer.concat([discriminator, encodedUsername]),
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: usernamePda, role: AccountRole.WRITABLE },
      { address: usernameRecordPda, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, keypair.keyPair);

  return sig;
};

interface Username {
  value: string;
}

export const getUsernameRecordAccount = async (
  keypair: KeyPairSigner,
  programAddress: Address,
  changeCount: bigint,
) => {
  const client = initRpcClient();
  const pda = await getUsernameRecordAccountPda(keypair.address, programAddress, changeCount);
  const account = await fetchEncodedAccount(client, pda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${pda} does not exist`);
  }

  assertAccountExists(account);

  const decoded = usernameRecordAccountDecoder.decode(account.data);

  return decoded;
};

const getUsernameRecordAccountPda = async (userAddress: Address, programAddress: Address, changeCount: bigint) => {
  const changeCountSeed = Buffer.alloc(8);
  changeCountSeed.writeBigInt64LE(changeCount);
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from("username_record"), getAddressEncoder().encode(userAddress), changeCountSeed],
  });
  return pda;
};

const usernameEncoder: Encoder<{ value: string }> = getStructEncoder([
  ["value", addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
]);

const usernameDecoder = getStructDecoder([
  ["value", addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
]);

const usernameAccountDecoder: Decoder<{
  authority: Address;
  username: Username;
  change_count: bigint;
  username_recent_history: Username[];
}> = offsetDecoder(
  getStructDecoder([
    ["authority", getAddressDecoder()],
    ["username", usernameDecoder],
    ["change_count", getU64Decoder()],
    ["username_recent_history", getArrayDecoder(usernameDecoder, { size: getU32Decoder() })],
  ]),
  skipAnchorDiscriminator,
);

const usernameRecordAccountDecoder: Decoder<{
  authority: Address;
  old_username: Username;
  change_index: bigint;
}> = offsetDecoder(
  getStructDecoder([
    ["authority", getAddressDecoder()],
    ["old_username", usernameDecoder],
    ["change_index", getU64Decoder()],
  ]),
  skipAnchorDiscriminator,
);
