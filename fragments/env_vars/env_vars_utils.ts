import { env } from "node:process";

export const getEnvVar = (name: string) => {
  return env[name];
};
