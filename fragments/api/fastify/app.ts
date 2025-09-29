import fastify from "fastify";
import { routes as postgres } from "./datastore/postgres";

export const build = () => {
  const api = fastify({ logger: true });
  api.register(postgres, { prefix: "/postgres" });
  return api;
};
