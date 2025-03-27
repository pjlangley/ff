import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";
import { webcrypto } from "node:crypto";

interface CryptoKeyPair {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
}

export const createKeyPair = async () => {
  const keypair = await generateKeyPair();
  return keypair;
};

export const getAddress = async (keypair: CryptoKeyPair) => {
  const address = await getAddressFromPublicKey(keypair.publicKey);
  return address;
};
