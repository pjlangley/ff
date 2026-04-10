import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  isSome,
  type KeyPairSigner,
  unwrapOption,
} from "@solana/kit";
import { readFileSync } from "node:fs";
import {
  confirmRegistration,
  getRegistrationAccount,
  getRegistryStateAccount,
  initialiseRegistry,
  register,
} from "../../../solana_program_register/solana_register_interface";
import { getEnvVar } from "../../../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../../../solana_airdrop/solana_airdrop_utils";
import { confirmRecentSignature } from "../../../solana_transaction/solana_transaction_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// In-memory storage for registrant keypairs
// In production, use a secure key management service or encrypted database
const keypairStorage: Record<string, KeyPairSigner> = {};

let cachedAuthority: KeyPairSigner | null = null;

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
};

const getAuthority = async (): Promise<KeyPairSigner> => {
  if (!cachedAuthority) {
    const keypairPath = getEnvVar("SOLANA_KEYPAIR_PATH") || "./solana_program_keys/solana_deployer.json";
    cachedAuthority = await loadKeypairFromFile(keypairPath);
  }
  return cachedAuthority;
};

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.post<{
    Reply: {
      200: { authority: string };
      500: { error: string };
    };
  }>("/register/initialise", async (request, reply) => {
    try {
      const programAddress = getProgramAddress();
      const authority = await getAuthority();
      await sendAndConfirmAirdrop(authority.address, BigInt(LAMPORTS_PER_SOL));

      try {
        const signature = await initialiseRegistry(authority, programAddress);
        await confirmRecentSignature(signature);
      } catch (error) {
        const errorMessage = (error as { context?: { logs?: string[] } })?.context?.logs?.join(" ") ?? "";
        if (!errorMessage.includes("already in use")) {
          throw error;
        }
        request.log.info("Registry already initialised, skipping initialisation step");
      }

      return reply.code(200).send({ authority: authority.address });
    } catch (error) {
      request.log.error(error, "Error initialising registry");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.post<{
    Reply: {
      200: { address: string };
      500: { error: string };
    };
  }>("/register/register", async (request, reply) => {
    try {
      const programAddress = getProgramAddress();
      const signer = await generateKeyPairSigner();
      await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
      keypairStorage[signer.address] = signer;
      request.log.info({ address: signer.address }, "Keypair stored for registrant");

      const signature = await register(signer, programAddress);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({ error: "Transaction sent but confirmation timed out" });
      }

      return reply.code(200).send({ address: signer.address });
    } catch (error) {
      request.log.error(error, "Error registering");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Reply: {
      200: { authority: string; registration_count: string };
      500: { error: string };
    };
  }>("/register/registry", async (request, reply) => {
    try {
      const programAddress = getProgramAddress();
      const account = await getRegistryStateAccount(programAddress);

      return reply.code(200).send({
        authority: account.authority,
        registration_count: account.registration_count.toString(),
      });
    } catch (error) {
      request.log.error(error, "Error fetching registry state");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { address: string };
    Reply: {
      200: {
        registrant: string;
        registration_index: string;
        registered_at: string;
        confirmed_at: string | null;
      };
      404: void;
      500: { error: string };
    };
  }>("/register/:address", async (request, reply) => {
    try {
      const { address } = request.params;
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      const programAddress = getProgramAddress();
      const account = await getRegistrationAccount(keypair.address, programAddress);

      return reply.code(200).send({
        registrant: account.registrant,
        registration_index: account.registration_index.toString(),
        registered_at: account.registered_at.toString(),
        confirmed_at: isSome(account.confirmed_at) && unwrapOption(account.confirmed_at)?.toString() || null,
      });
    } catch (error) {
      request.log.error(error, "Error fetching registration account");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.patch<{
    Params: { address: string };
    Reply: {
      200: void;
      404: void;
      500: { error: string };
    };
  }>("/register/:address/confirm", async (request, reply) => {
    try {
      const { address: registrantAddress } = request.params;
      const registrant = keypairStorage[registrantAddress];

      if (!registrant) {
        return reply.code(404).send();
      }

      const programAddress = getProgramAddress();
      const authority = await getAuthority();
      await sendAndConfirmAirdrop(authority.address, BigInt(LAMPORTS_PER_SOL));

      const signature = await confirmRegistration(authority, programAddress, address(registrantAddress));
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({ error: "Transaction sent but confirmation timed out" });
      }

      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error confirming registration");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};

const getProgramAddress = (): Address => {
  const programId = getEnvVar("register_PROGRAM_ID");
  if (!programId) {
    throw new Error("environment variable register_PROGRAM_ID is not set");
  }
  return address(programId);
};
