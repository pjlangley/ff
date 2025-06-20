import {
  AccountRole,
  Address,
  appendTransactionMessageInstruction,
  assertAccountExists,
  Decoder,
  fetchEncodedAccount,
  getStructDecoder,
  getU64Decoder,
  KeyPairSigner,
  offsetDecoder,
} from "@solana/kit";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import { getInstructionDiscriminator, getPda } from "../solana_program/solana_program_utils";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import {
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "../solana_transaction/solana_transaction_utils";

export const initializeAccount = async (keypair: KeyPairSigner, programAddress: Address) => {
  const discriminator = getInstructionDiscriminator("initialize", "counter");
  const feePayer = keypair.address;
  const counterPda = await getPda(feePayer, programAddress, "counter");

  const baseTx = await createBaseTxWithFeePayerAndLifetime(feePayer);
  const initializeTransaction = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: counterPda, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const signature = await signAndSendTransaction(initializeTransaction, keypair.keyPair);

  return signature;
};

export const getCount = async (keypair: KeyPairSigner, programAddress: Address) => {
  const client = initRpcClient();
  const counterPda = await getPda(keypair.address, programAddress, "counter");
  const account = await fetchEncodedAccount(client, counterPda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${counterPda} does not exist`);
  }

  assertAccountExists(account);

  const decoder: Decoder<{ count: bigint }> = offsetDecoder(
    getStructDecoder([
      ["count", getU64Decoder()],
    ]),
    {
      // removes the discriminator from the account data
      preOffset: ({ wrapBytes }) => wrapBytes(8),
    },
  );

  const decoded = decoder.decode(account.data);

  return decoded.count;
};

export const incrementCounter = async (keypair: KeyPairSigner, programKey: Address) => {
  const discriminator = getInstructionDiscriminator("increment", "counter");
  const feePayer = keypair.address;
  const counterPda = await getPda(feePayer, programKey, "counter");

  const baseTx = await createBaseTxWithFeePayerAndLifetime(feePayer);
  const incrementTransaction = appendTransactionMessageInstruction({
    programAddress: programKey,
    data: discriminator,
    accounts: [
      { address: counterPda, role: AccountRole.WRITABLE },
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
    ],
  }, baseTx);

  const signature = await signAndSendTransaction(incrementTransaction, keypair.keyPair);

  return signature;
};
