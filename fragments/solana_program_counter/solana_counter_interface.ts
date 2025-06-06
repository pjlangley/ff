import {
  AccountRole,
  Address,
  appendTransactionMessageInstruction,
  assertAccountExists,
  CompilableTransactionMessage,
  compileTransaction,
  createTransactionMessage,
  decodeAccount,
  Decoder,
  fetchEncodedAccount,
  getBase64EncodedWireTransaction,
  getStructDecoder,
  getU64Decoder,
  KeyPairSigner,
  offsetDecoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
} from "@solana/kit";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import { getInstructionDiscriminator, getPda } from "../solana_program/solana_program_utils";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";

export const initializeAccount = async (keypair: KeyPairSigner, programAddress: Address) => {
  const discriminator = getInstructionDiscriminator("initialize", "counter");
  const feePayer = keypair.address;
  const counterPda = await getPda(feePayer, programAddress, "counter");

  const baseTx = await createBaseTransaction(feePayer);
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
      preOffset: ({ wrapBytes }) => wrapBytes(-8),
    },
  );
  const decodedAccount = decodeAccount(account, decoder);

  return decodedAccount.data.count;
};

export const incrementCounter = async (keypair: KeyPairSigner, programKey: Address) => {
  const discriminator = getInstructionDiscriminator("increment", "counter");
  const feePayer = keypair.address;
  const counterPda = await getPda(feePayer, programKey, "counter");

  const baseTx = await createBaseTransaction(feePayer);
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

const createBaseTransaction = async (feePayer: Address) => {
  const client = initRpcClient();
  const { value: latestBlockhash } = await client.getLatestBlockhash().send();

  const tx = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  );

  return tx;
};

const signAndSendTransaction = async (tx: CompilableTransactionMessage, keypair: KeyPairSigner["keyPair"]) => {
  const client = initRpcClient();
  const compiledTx = compileTransaction(tx);
  const signedTx = await signTransaction([keypair], compiledTx);
  const serializedTransaction = getBase64EncodedWireTransaction(signedTx);
  const signature = await client.sendTransaction(serializedTransaction, { encoding: "base64" }).send();

  return signature;
};
