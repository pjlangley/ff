import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { isAddress } from "@solana/kit";
import { getBalance } from "../../../solana_balance/solana_balance_utils";

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.get<{
    Params: { address: string };
    Reply: {
      200: { balance: string };
      400: { error: string };
      500: { error: string };
    };
  }>("/balance/:address", async (request, reply) => {
    try {
      const { address } = request.params;

      if (!isAddress(address)) {
        return reply.code(400).send({ error: "Invalid Solana address" });
      }

      const balance = await getBalance(address);
      return {
        balance: balance.toString(),
      };
    } catch (error) {
      request.log.error(error, "Error fetching balance");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};
