import fastify from "fastify";
import { routes as postgres } from "./datastore/postgres";
import { routes as redis } from "./datastore/redis";

export const build = () => {
  const api = fastify({ logger: true });
  api.register(postgres, { prefix: "/postgres" });
  api.register(redis, { prefix: "/redis" });
  return api;
};
