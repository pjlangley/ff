import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { Address, address, generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import {
  activateRound,
  completeRound,
  getRoundAccount,
  initialiseRound,
} from "../../../solana_program_round/solana_round_interface";
import { getEnvVar } from "../../../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../../../solana_airdrop/solana_airdrop_utils";
import { confirmRecentSignature } from "../../../solana_transaction/solana_transaction_utils";
import { initRpcClient } from "../../../solana_rpc/solana_rpc_utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { isSome, unwrapOption } from "@solana/kit";

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
const keypairStorage: Record<string, KeyPairSigner> = {};

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  const client = initRpcClient();

  fastify.post<{
    Reply: {
      200: { address: string; start_slot: string };
      400: { error: string };
      500: { error: string };
    };
  }>("/round/initialise", async (request, reply) => {
    try {
      const programAddress = getProgramAddress();

      const signer = await generateKeyPairSigner();
      await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));
      keypairStorage[signer.address] = signer;
      request.log.info({ address: signer.address }, "Keypair stored for round authority");

      const recentSlot = await client.getSlot({ commitment: "confirmed" }).send();
      const startSlot = recentSlot + 3n;

      const signature = await initialiseRound(signer, programAddress, startSlot);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({ error: "Transaction sent but confirmation timed out" });
      }

      return reply.code(200).send({
        address: signer.address,
        start_slot: startSlot.toString(),
      });
    } catch (error) {
      request.log.error(error, "Error initialising round");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { address: string };
    Reply: {
      200: {
        start_slot: string;
        authority: string;
        activated_at: string | null;
        activated_by: string | null;
        completed_at: string | null;
      };
      404: void;
      500: { error: string };
    };
  }>("/round/:address", async (request, reply) => {
    try {
      const { address } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      const account = await getRoundAccount(keypair.address, programAddress);

      return reply.code(200).send({
        start_slot: account.start_slot.toString(),
        authority: account.authority,
        activated_at: isSome(account.activated_at) && unwrapOption(account.activated_at)?.toString() || null,
        activated_by: isSome(account.activated_by) && unwrapOption(account.activated_by) || null,
        completed_at: isSome(account.completed_at) && unwrapOption(account.completed_at)?.toString() || null,
      });
    } catch (error) {
      request.log.error(error, "Error fetching round account");
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
  }>("/round/:address/activate", async (request, reply) => {
    try {
      const { address: roundAddress } = request.params;
      const programAddress = getProgramAddress();
      const roundExists = keypairStorage[roundAddress];

      if (!roundExists) {
        return reply.code(404).send();
      }

      const signer = await generateKeyPairSigner();
      await sendAndConfirmAirdrop(signer.address, BigInt(LAMPORTS_PER_SOL));

      const signature = await activateRound(signer, programAddress, address(roundAddress));
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({ error: "Transaction sent but confirmation timed out" });
      }

      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error activating round");
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
  }>("/round/:address/complete", async (request, reply) => {
    try {
      const { address } = request.params;
      const programAddress = getProgramAddress();
      const keypair = keypairStorage[address];

      if (!keypair) {
        return reply.code(404).send();
      }

      const signature = await completeRound(keypair, programAddress);
      const confirmed = await confirmRecentSignature(signature);

      if (!confirmed) {
        return reply.code(500).send({ error: "Transaction sent but confirmation timed out" });
      }

      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error completing round");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};

const getProgramAddress = (): Address => {
  const programId = getEnvVar("round_PROGRAM_ID");
  if (!programId) {
    throw new Error("environment variable round_PROGRAM_ID is not set");
  }
  return address(programId);
};
