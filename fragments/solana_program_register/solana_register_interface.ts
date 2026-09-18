import {
  AccountRole,
  Address,
  appendTransactionMessageInstruction,
  assertAccountExists,
  Decoder,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getBase58Decoder,
  getOptionDecoder,
  type GetProgramAccountsDatasizeFilter,
  type GetProgramAccountsMemcmpFilter,
  getProgramDerivedAddress,
  getStructDecoder,
  getU64Decoder,
  getU64Encoder,
  KeyPairSigner,
  offsetDecoder,
  Option,
} from "@solana/kit";
import {
  BPF_LOADER_UPGRADEABLE_ID,
  getInstructionDiscriminator,
  getPda,
  skipAnchorDiscriminator,
} from "../solana_program/solana_program_utils";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { Buffer } from "node:buffer";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import {
  createBaseTxWithFeePayerAndLifetime,
  signAndSendTransaction,
} from "../solana_transaction/solana_transaction_utils";

export const initialiseRegistry = async (authority: KeyPairSigner, programAddress: Address) => {
  const discriminator = getInstructionDiscriminator("initialise_registry", "register");
  const payer = authority.address;
  const registryStatePda = await getRegistryStatePda(programAddress);
  const programDataAddress = await getProgramDataAddress(programAddress);
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: registryStatePda, role: AccountRole.WRITABLE },
      { address: programDataAddress, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, authority.keyPair);

  return sig;
};

export const register = async (registrant: KeyPairSigner, programAddress: Address) => {
  const discriminator = getInstructionDiscriminator("register", "register");
  const payer = registrant.address;
  const registryStatePda = await getRegistryStatePda(programAddress);
  const registrationPda = await getPda(payer, programAddress, "registration");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(payer);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: registryStatePda, role: AccountRole.WRITABLE },
      { address: registrationPda, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, registrant.keyPair);

  return sig;
};

export const confirmRegistration = async (
  authority: KeyPairSigner,
  programAddress: Address,
  registrantAddress: Address,
) => {
  const discriminator = getInstructionDiscriminator("confirm_registration", "register");
  const registryStatePda = await getRegistryStatePda(programAddress);
  const registrationPda = await getPda(registrantAddress, programAddress, "registration");
  const baseTx = await createBaseTxWithFeePayerAndLifetime(authority.address);

  const tx = appendTransactionMessageInstruction({
    programAddress,
    data: discriminator,
    accounts: [
      { address: registryStatePda, role: AccountRole.READONLY },
      { address: authority.address, role: AccountRole.READONLY_SIGNER },
      { address: registrationPda, role: AccountRole.WRITABLE },
    ],
  }, baseTx);

  const sig = await signAndSendTransaction(tx, authority.keyPair);

  return sig;
};

export const getRegistryStateAccount = async (programAddress: Address) => {
  const client = initRpcClient();
  const registryStatePda = await getRegistryStatePda(programAddress);
  const account = await fetchEncodedAccount(client, registryStatePda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${registryStatePda} does not exist`);
  }

  assertAccountExists(account);

  const decoded = registryStateDecoder.decode(account.data);

  return decoded;
};

export const getRegistrationAccount = async (registrantAddress: Address, programAddress: Address) => {
  const client = initRpcClient();
  const registrationPda = await getPda(registrantAddress, programAddress, "registration");
  const account = await fetchEncodedAccount(client, registrationPda, {
    commitment: "confirmed",
    abortSignal: AbortSignal.timeout(5000),
  });

  if (!account.exists) {
    throw new Error(`Account ${registrationPda} does not exist`);
  }

  assertAccountExists(account);

  const decoded = registrationDecoder.decode(account.data);

  return decoded;
};

/**
 * Looks a `Registration` account up by the index the program assigned it, rather than by registrant.
 *
 * The index is not part of the PDA seeds, so there is no address to derive; instead the program's
 * accounts are scanned server-side with `registrationIndexFilters`. Unlike the PDA getters, absence is
 * an ordinary outcome of a filtered scan, so it is reported as `undefined` rather than thrown.
 */
export const getRegistrationAccountByIndex = async (
  index: bigint,
  programAddress: Address,
): Promise<RegistrationAccount | undefined> => {
  const client = initRpcClient();
  const accounts = await client
    .getProgramAccounts(programAddress, {
      commitment: "confirmed",
      encoding: "base64",
      filters: registrationIndexFilters(index),
    })
    .send({ abortSignal: AbortSignal.timeout(5000) });

  const account = accounts.at(0);

  if (!account) {
    return undefined;
  }

  return registrationDecoder.decode(Buffer.from(account.account.data[0], "base64"));
};

const getProgramDataAddress = async (programAddress: Address): Promise<Address> => {
  const [pda] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE_ID,
    seeds: [getAddressEncoder().encode(programAddress)],
  });
  return pda;
};

const getRegistryStatePda = async (programAddress: Address): Promise<Address> => {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from("registry_state")],
  });
  return pda;
};

const registryStateDecoder: Decoder<{
  authority: Address;
  registration_count: bigint;
}> = offsetDecoder(
  getStructDecoder([
    ["authority", getAddressDecoder()],
    ["registration_count", getU64Decoder()],
  ]),
  skipAnchorDiscriminator,
);

// Byte layout of a `Registration` account, mirroring the Rust struct in `programs/register/src/lib.rs`:
//
//   0..8    anchor account discriminator
//   8..40   registrant           Pubkey
//   40..48  registration_index   u64 (little-endian)
//   48..56  registered_at        u64 (little-endian)
//   56..65  confirmed_at         Option<u64> (1 discriminant byte + 8 payload, per Anchor's InitSpace)
//
// Both constants live here, beside the decoder, so the raw-byte filter below (`getProgramAccounts` +
// `memcmp` lookup by index) cannot drift from the layout the decoder assumes.
export const REGISTRATION_INDEX_OFFSET = 40;
export const REGISTRATION_ACCOUNT_SIZE = 65;

/**
 * Server-side filters that isolate the single `Registration` account at `index`.
 *
 * `memcmp` compares raw account bytes, so the index is encoded exactly as the account stores it —
 * a little-endian u64 at offset 40 — and then base58-encoded because that is the wire format the
 * filter takes. The `dataSize` filter keeps the scan off every other account the program owns.
 */
export const registrationIndexFilters = (
  index: bigint,
): [GetProgramAccountsDatasizeFilter, GetProgramAccountsMemcmpFilter] => [
  { dataSize: BigInt(REGISTRATION_ACCOUNT_SIZE) },
  {
    memcmp: {
      offset: BigInt(REGISTRATION_INDEX_OFFSET),
      bytes: getBase58Decoder().decode(getU64Encoder().encode(index)),
      encoding: "base58",
    },
  },
];

export const registrationDecoder: Decoder<{
  registrant: Address;
  registration_index: bigint;
  registered_at: bigint;
  confirmed_at: Option<bigint>;
}> = offsetDecoder(
  getStructDecoder([
    ["registrant", getAddressDecoder()],
    ["registration_index", getU64Decoder()],
    ["registered_at", getU64Decoder()],
    ["confirmed_at", getOptionDecoder(getU64Decoder())],
  ]),
  skipAnchorDiscriminator,
);

export type RegistrationAccount = ReturnType<typeof registrationDecoder["decode"]>;
