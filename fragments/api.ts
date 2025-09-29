import process from "node:process";
import { build } from "./api/fastify/app";
import { getEnvVar } from "./env_vars/env_vars_utils";

const api = build();
const host = getEnvVar("FASTIFY_HOST") || "localhost";

api.listen({ port: 3000, host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(`Server listening at ${address}`);
});
