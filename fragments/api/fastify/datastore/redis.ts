import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { redisCreate, redisDelete, redisPing, redisRead, redisUpdate } from "../../../redis_db/redis_crud";

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.get<{
    Reply: {
      200: { message: string };
      500: { error: string };
    };
  }>("/ping", async (request, reply) => {
    try {
      const result = await redisPing();
      return { message: result };
    } catch (error) {
      request.log.error(error, "Error pinging Redis");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { namespace: string };
    Reply: {
      200: { favourite_coin?: string };
      404: void;
      500: { error: string };
    };
  }>("/favourites/:namespace", async (request, reply) => {
    try {
      const { namespace } = request.params;
      const item = await redisRead(namespace);

      if (!item.favourite_coin) {
        return reply.code(404).send();
      }
      return item;
    } catch (error) {
      request.log.error(error, "Error reading favourite coin from Redis");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.put<{
    Body: { favourite_coin: string };
    Params: { namespace: string };
    Reply: {
      200: void;
      400: { error: string };
      500: { error: string };
    };
  }>("/favourites/:namespace", {
    schema: {
      body: {
        type: "object",
        required: ["favourite_coin"],
        properties: {
          favourite_coin: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { namespace } = request.params;
      const { favourite_coin } = request.body;
      const result = await redisCreate(namespace, favourite_coin);
      if (result !== "OK") {
        throw new Error(result);
      }
      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error creating favourite coin in Redis");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.patch<{
    Body: { favourite_coin: string };
    Params: { namespace: string };
    Reply: {
      200: void;
      500: { error: string };
    };
  }>("/favourites/:namespace", {
    schema: {
      body: {
        type: "object",
        required: ["favourite_coin"],
        properties: {
          favourite_coin: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { namespace } = request.params;
      const { favourite_coin } = request.body;
      const result = await redisUpdate(namespace, favourite_coin);
      if (result !== "OK") {
        throw new Error(result);
      }
      return reply.code(200).send();
    } catch (error) {
      request.log.error(error, "Error updating favourite coin in Redis");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.delete<{
    Params: { namespace: string };
    Reply: {
      204: void;
      500: { error: string };
    };
  }>("/favourites/:namespace", async (request, reply) => {
    try {
      const { namespace } = request.params;
      const result = await redisDelete(namespace);
      if (result !== "OK") {
        throw new Error(result);
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, "Error deleting favourite coin from Redis");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};
