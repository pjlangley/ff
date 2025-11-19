import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { Address, address, generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import {
  getCount,
  incrementCounter,
  initializeAccount,
} from "../../../solana_program_counter/solana_counter_interface";
import { getEnvVar } from "../../../env_vars/env_vars_utils";
import { confirmRecentSignature } from "../../../solana_transaction/solana_transaction_utils";
import { sendAndConfirmAirdrop } from "../../../solana_airdrop/solana_airdrop_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
const keypairStorage: Record<string, KeyPairSigner> = {};

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.get<{
    Params: { address: string };
    Reply: {
      200: { count: string };
      404: void;
      500: { error: string };
    };
  }>("/counter/:address", async (request, reply) => {
    try {
      const { address } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];
      if (!keypair) {
        return reply.code(404).send();
      }

      const count = await getCount(keypair, programAddress);
      return {
        count: count.toString(),
      };
    } catch (error) {
      request.log.error(error, "Error fetching counter");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.post<{
    Reply: {
      200: {
        address: string;
      };
      500: { error: string };
    };
  }>("/counter/initialise", async (request, reply) => {
    try {
      const programAddress = getProgramAddress();
      const signer = await generateKeyPairSigner();
      await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
      keypairStorage[signer.address] = signer;
      request.log.info({ address: signer.address }, "Keypair stored for future operations");

      const signature = await initializeAccount(signer, programAddress);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({
          error: "Transaction sent but confirmation timed out",
        });
      }

      return {
        address: signer.address,
      };
    } catch (error) {
      request.log.error(error, "Error initialising counter");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.patch<{
    Params: { address: string };
    Reply: {
      200: {
        new_count: string;
      };
      404: void;
      500: { error: string };
    };
  }>("/counter/:address/increment", async (request, reply) => {
    try {
      const { address } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];
      if (!keypair) {
        return reply.code(404).send();
      }

      const signature = await incrementCounter(keypair, programAddress);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({
          error: "Transaction sent but confirmation timed out",
        });
      }

      const newCount = await getCount(keypair, programAddress);

      return {
        new_count: newCount.toString(),
      };
    } catch (error) {
      request.log.error(error, "Error incrementing counter");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};

const getProgramAddress = (): Address => {
  const programId = getEnvVar("counter_PROGRAM_ID");
  if (!programId) {
    throw new Error("environment variable counter_PROGRAM_ID is not set");
  }
  return address(programId);
};
