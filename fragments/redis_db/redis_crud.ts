import { createClient } from "redis";
import { getEnvVar } from "../env_vars/env_vars_utils";

const initClient = async () => {
  const host = getEnvVar("REDIS_HOST");
  const client = createClient({
    url: host ? `redis://${host}:6379` : undefined,
  });
  client.on("error", (err) => {
    console.error("Redis Client Error");
    throw err;
  });
  await client.connect();
  return client;
};

export const redisPing = async () => {
  const client = await initClient();
  const pong = await client.ping();
  await client.quit();
  return pong;
};

export const redisCreate = async (namespace: string, favouriteCoin: string) => {
  const client = await initClient();
  await client.hSet(namespace, {
    favouriteCoin: favouriteCoin,
  });
  await client.quit();
  return "OK";
};

export const redisRead = async (namespace: string) => {
  const client = await initClient();
  const item = await client.hGetAll(namespace);
  await client.quit();
  return item;
};

export const redisUpdate = async (namespace: string, favouriteCoin: string) => {
  const client = await initClient();
  await client.hSet(namespace, "favouriteCoin", favouriteCoin);
  await client.quit();
  return "OK";
};

export const redisDelete = async (namespace: string) => {
  const client = await initClient();
  await client.del(namespace);
  await client.quit();
  return "OK";
};
