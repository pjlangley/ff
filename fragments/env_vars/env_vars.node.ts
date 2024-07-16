import { env } from 'node:process';

export const get_env_var = (name: string) => {
  return env[name];
};
