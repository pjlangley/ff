import {
  AccountRole,
  Address,
  appendTransactionMessageInstruction,
  assertAccountExists,
  Decoder,
  fetchEncodedAccount,
  getAddressDecoder,
  getOptionDecoder,
  getStructDecoder,
  getU64Decoder,
  getU64Encoder,
  KeyPairSigner,
  offsetDecoder,
  Option,
} from "@solana/kit";
import { getInstructionDiscriminator, getPda } from "../solana_program/solana_program_utils";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { Buffer } from "node:buffer";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import {
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "../solana_transaction/solana_transaction_utils";

export const initialiseRound = async (
  authority: KeyPairSigner,
  programAddress: Address,
  startSlot: bigint,
) => {
  const discriminator = getInstructionDiscriminator("initialise_round", "round");
  const payer = authority.address;
  const pda = await getPda(payer, programAddress, "round");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: Buffer.concat([discriminator, Buffer.from(getU64Encoder().encode(startSlot))]),
    accounts: [
      { address: pda, role: AccountRole.WRITABLE },
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, authority.keyPair);

  return sig;
};

export const getRoundAccount = async (authority: Address, programAddress: Address) => {
  const client = initRpcClient();
  const pda = await getPda(authority, programAddress, "round");
  const account = await fetchEncodedAccount(client, pda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${pda} does not exist`);
  }

  assertAccountExists(account);

  const decoded = roundAccountDecoder.decode(account.data);

  return decoded;
};

export const activateRound = async (payer: KeyPairSigner, programAddress: Address, authority: Address) => {
  const discriminator = getInstructionDiscriminator("activate_round", "round");
  const pda = await getPda(authority, programAddress, "round");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer.address);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: pda, role: AccountRole.WRITABLE },
      { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, payer.keyPair);

  return sig;
};

export const completeRound = async (authority: KeyPairSigner, programAddress: Address) => {
  const discriminator = getInstructionDiscriminator("complete_round", "round");
  const pda = await getPda(authority.address, programAddress, "round");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(authority.address);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: pda, role: AccountRole.WRITABLE },
      { address: authority.address, role: AccountRole.WRITABLE_SIGNER },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, authority.keyPair);

  return sig;
};

const roundAccountDecoder: Decoder<{
  start_slot: bigint;
  authority: Address;
  activated_at: Option<bigint>;
  activated_by: Option<Address>;
  completed_at: Option<bigint>;
}> = offsetDecoder(
  getStructDecoder([
    ["start_slot", getU64Decoder()],
    ["authority", getAddressDecoder()],
    ["activated_at", getOptionDecoder(getU64Decoder())],
    ["activated_by", getOptionDecoder(getAddressDecoder())],
    ["completed_at", getOptionDecoder(getU64Decoder())],
  ]),
  {
    preOffset: ({ wrapBytes }) => wrapBytes(8), // removes the discriminator from the account data
  },
);
