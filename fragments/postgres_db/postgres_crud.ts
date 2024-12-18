import { Client } from "pg";
import { getEnvVar } from "../env_vars/env_vars_utils";

const INIT_DB_SQL = `
CREATE TABLE IF NOT EXISTS crypto_coins (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(8) NOT NULL UNIQUE,
  name VARCHAR(30) NOT NULL,
  launched SMALLINT NOT NULL
);
`;

const DB_SEED_SQL = `
INSERT INTO crypto_coins (ticker, name, launched) VALUES
('BTC', 'Bitcoin', 2009),
('ETH', 'Ethereum', 2015),
('SOL', 'Solana', 2020)
ON CONFLICT (ticker) DO NOTHING;
`;

interface CryptoCoin {
  id: number;
  ticker: string;
  name: string;
  launched: number;
}

const initClient = async () => {
  const isCI = getEnvVar("CI");
  const client = new Client({
    connectionString: `postgres://postgres:pgpass@${isCI ? "postgres" : "localhost"}:5432`,
  });
  client.on("error", (err) => {
    console.error("Postgres client error");
    throw err;
  });
  await client.connect();
  await client.query(INIT_DB_SQL);
  await client.query(DB_SEED_SQL);
  return client;
};

export const getItemByTicker = async (ticker: string) => {
  const client = await initClient();
  const result = await client.query<CryptoCoin>("SELECT * FROM crypto_coins WHERE ticker = $1 LIMIT 1", [ticker]);
  await client.end();
  return result.rows;
};

export const getItemsAfterLaunchYear = async (launchYear: number) => {
  const client = await initClient();
  const result = await client.query<CryptoCoin>("SELECT * FROM crypto_coins WHERE launched > $1", [launchYear]);
  await client.end();
  return result.rows;
};

export const getAllItems = async () => {
  const client = await initClient();
  const result = await client.query<CryptoCoin>("SELECT * FROM crypto_coins ORDER BY launched DESC");
  await client.end();
  return result.rows;
};

export const addItem = async (coin: Omit<CryptoCoin, "id">) => {
  const client = await initClient();
  await client.query(
    "INSERT INTO crypto_coins (ticker, name, launched) VALUES($1, $2, $3) ON CONFLICT (ticker) DO NOTHING",
    [coin.ticker, coin.name, coin.launched],
  );
  await client.end();
  return "ok";
};

export const removeItem = async (ticker: string) => {
  const client = await initClient();
  const result = await client.query<CryptoCoin>("DELETE FROM crypto_coins WHERE ticker = $1 RETURNING *", [ticker]);
  await client.end();
  return result.rows;
};

export const updateItem = async (coin: Omit<CryptoCoin, "id">) => {
  const client = await initClient();
  const result = await client.query<CryptoCoin>(
    "UPDATE crypto_coins SET name = $1, launched = $2 WHERE ticker = $3 RETURNING *",
    [coin.name, coin.launched, coin.ticker],
  );
  await client.end();
  return result.rows;
};
