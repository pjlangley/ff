import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { Address, address, generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import {
  getUsernameAccount,
  getUsernameRecordAccount,
  initializeUsername,
  updateUsername,
} from "../../../solana_program_username/solana_username_interface";
import { getEnvVar } from "../../../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../../../solana_airdrop/solana_airdrop_utils";
import { confirmRecentSignature } from "../../../solana_transaction/solana_transaction_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
const keypairStorage: Record<string, KeyPairSigner> = {};

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.post<{
    Body: { username: string };
    Reply: {
      200: { address: string };
      500: { error: string };
    };
  }>("/username/initialise", async (request, reply) => {
    try {
      const { username } = request.body;
      const programAddress = getProgramAddress();

      const signer = await generateKeyPairSigner();
      await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
      keypairStorage[signer.address] = signer;
      request.log.info({ address: signer.address }, "Keypair stored for username account");

      const signature = await initializeUsername(signer, programAddress, username);
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
      request.log.error(error, "Error initialising username account");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { address: string };
    Reply: {
      200: { username: string; change_count: string; username_recent_history: string[] };
      404: void;
      500: { error: string };
    };
  }>("/username/:address", async (request, reply) => {
    try {
      const { address } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      const account = await getUsernameAccount(keypair, programAddress);

      return reply.code(200).send({
        username: account.username.value,
        change_count: account.change_count.toString(),
        username_recent_history: account.username_recent_history.map((u) => u.value),
      });
    } catch (error) {
      request.log.error(error, "Error fetching username account");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.patch<{
    Params: { address: string };
    Body: { username: string };
    Reply: {
      200: void;
      404: void;
      500: { error: string };
    };
  }>("/username/:address", async (request, reply) => {
    try {
      const { address } = request.params;
      const { username } = request.body;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      const signature = await updateUsername(keypair, programAddress, username);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({
          error: "Transaction sent but confirmation timed out",
        });
      }

      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error updating username");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { address: string; changeIndex: string };
    Reply: {
      200: { old_username: string; change_index: string; authority: Address };
      404: void;
      500: { error: string };
    };
  }>("/username/:address/record/:changeIndex", async (request, reply) => {
    try {
      const { address, changeIndex } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      try {
        const account = await getUsernameRecordAccount(keypair, programAddress, BigInt(changeIndex));
        return reply.code(200).send({
          old_username: account.old_username.value,
          change_index: account.change_index.toString(),
          authority: account.authority,
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("does not exist")) {
          return reply.code(404).send();
        }
        throw e;
      }
    } catch (error) {
      request.log.error(error, "Error fetching username record");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};

const getProgramAddress = (): Address => {
  const programId = getEnvVar("username_PROGRAM_ID");
  if (!programId) {
    throw new Error("environment variable username_PROGRAM_ID is not set");
  }
  return address(programId);
};
