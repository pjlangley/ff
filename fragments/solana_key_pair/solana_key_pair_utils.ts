import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";

export const createKeyPair = async () => {
  const keypair = await generateKeyPair();
  return keypair;
};

export const getAddress = async (publicKey: CryptoKey) => {
  const address = await getAddressFromPublicKey(publicKey);
  return address;
};
