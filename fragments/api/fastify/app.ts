import fastify from "fastify";
import { routes as postgres } from "./datastore/postgres";
import { routes as redis } from "./datastore/redis";
import { routes as sqlite } from "./datastore/sqlite";
import { routes as solanaCounter } from "./blockchain/solana-counter";
import { routes as solanaUsername } from "./blockchain/solana_username";

export const build = () => {
  const api = fastify({ logger: true });
  api.register(postgres, { prefix: "/postgres" });
  api.register(redis, { prefix: "/redis" });
  api.register(sqlite, { prefix: "/sqlite" });
  api.register(solanaCounter, { prefix: "/solana" });
  api.register(solanaUsername, { prefix: "/solana" });
  return api;
};
