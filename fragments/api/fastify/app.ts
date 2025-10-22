import fastify from "fastify";
import { routes as postgres } from "./datastore/postgres";
import { routes as redis } from "./datastore/redis";
import { routes as sqlite } from "./datastore/sqlite";
import { routes as solanaCounter } from "./blockchain/solana_counter";
import { routes as solanaUsername } from "./blockchain/solana_username";
import { routes as solanaRound } from "./blockchain/solana_round";

export const build = () => {
  const api = fastify({ logger: true });
  api.register(postgres, { prefix: "/postgres" });
  api.register(redis, { prefix: "/redis" });
  api.register(sqlite, { prefix: "/sqlite" });
  api.register(solanaCounter, { prefix: "/solana" });
  api.register(solanaUsername, { prefix: "/solana" });
  api.register(solanaRound, { prefix: "/solana" });
  return api;
};
