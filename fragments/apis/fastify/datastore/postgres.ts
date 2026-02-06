import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import {
  addItem,
  type CryptoCoin,
  getAllItems,
  getItemByTicker,
  getItemsAfterLaunchYear,
  removeItem,
  updateItem,
} from "../../../postgres_db/postgres_crud";

export const routes = (fastify: FastifyInstance, _: FastifyPluginOptions) => {
  fastify.get<{
    Reply: {
      200: CryptoCoin[];
      500: { error: string };
    };
  }>("/coins", async (request, reply) => {
    try {
      const items = await getAllItems();
      return items;
    } catch (error) {
      request.log.error(error, "Error fetching coins");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { ticker: string };
    Reply: {
      200: CryptoCoin;
      404: void;
      500: { error: string };
    };
  }>("/coins/:ticker", async (request, reply) => {
    try {
      const { ticker } = request.params;
      const item = await getItemByTicker(ticker.toUpperCase());

      if (item.length === 0) {
        return reply.code(404).send();
      }
      return item[0];
    } catch (error) {
      request.log.error(error, "Error fetching coin by ticker");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.get<{
    Params: { year: number };
    Reply: {
      200: CryptoCoin[];
      500: { error: string };
    };
  }>("/coins/after/:year", async (request, reply) => {
    try {
      const { year } = request.params;
      const items = await getItemsAfterLaunchYear(year);
      return items;
    } catch (error) {
      request.log.error(error, "Error fetching coins after launch year");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.put<{
    Body: Omit<CryptoCoin, "id" | "ticker">;
    Params: { ticker: string };
    Reply: {
      200: void;
      400: { error: string };
      500: { error: string };
    };
  }>("/coins/:ticker", {
    schema: {
      body: {
        type: "object",
        required: ["name", "launched"],
        properties: {
          name: { type: "string" },
          launched: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ticker } = request.params;
      const { name, launched } = request.body;
      await addItem({
        name,
        launched,
        ticker: ticker.toUpperCase(),
      });
      return;
    } catch (error) {
      request.log.error(error, "Error adding coin");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.delete<{
    Params: { ticker: string };
    Reply: {
      204: void;
      500: { error: string };
    };
  }>("/coins/:ticker", async (request, reply) => {
    try {
      const { ticker } = request.params;
      await removeItem(ticker.toUpperCase());
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, "Error removing coin");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  fastify.patch<{
    Body: Omit<CryptoCoin, "id" | "ticker">;
    Params: { ticker: string };
    Reply: {
      200: CryptoCoin;
      404: void;
      500: { error: string };
    };
  }>("/coins/:ticker", {
    schema: {
      body: {
        type: "object",
        required: ["name", "launched"],
        properties: {
          name: { type: "string" },
          launched: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const { ticker } = request.params;
    const { name, launched } = request.body;
    try {
      const updatedItems = await updateItem({
        ticker: ticker.toUpperCase(),
        name,
        launched,
      });

      if (updatedItems.length === 0) {
        return reply.code(404).send();
      }
      return updatedItems[0];
    } catch (error) {
      request.log.error(error, "Error updating coin");
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });
};
