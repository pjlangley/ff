import Database from "better-sqlite3";
import process from "node:process";

const INIT_DB_SQL = `
CREATE TABLE IF NOT EXISTS crypto_coins (
  id INTEGER PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  launched INTEGER NOT NULL
);
INSERT INTO crypto_coins VALUES
(NULL, 'BTC', 'Bitcoin', 2009),
(NULL, 'ETH', 'Ethereum', 2015),
(NULL, 'SOL', 'Solana', 2020);
`;

export interface CryptoCoin {
  id: number;
  ticker: string;
  name: string;
  launched: number;
}

const db = new Database(":memory:");

try {
  db.exec(INIT_DB_SQL);
} catch (e) {
  console.error(e);
  process.exit(1);
}

export const getItemByTicker = (ticker: string) => {
  return db.prepare("SELECT * FROM crypto_coins WHERE ticker = ? LIMIT 1").get(ticker) as CryptoCoin | undefined;
};

export const getItemsAfterLaunchYear = (launchYear: number) => {
  return db.prepare("SELECT * FROM crypto_coins WHERE launched > ?").all(launchYear) as CryptoCoin[];
};

export const getAllItems = () => {
  return db.prepare("SELECT * FROM crypto_coins ORDER BY launched DESC").all() as CryptoCoin[];
};

export const addItem = (coin: Omit<CryptoCoin, "id">) => {
  db.prepare("INSERT OR IGNORE INTO crypto_coins VALUES(NULL, ?, ?, ?)")
    .run(coin.ticker, coin.name, coin.launched);
  return "ok";
};

export const updateItem = (coin: Omit<CryptoCoin, "id">) => {
  return db.prepare("UPDATE crypto_coins SET name = ?, launched = ? WHERE ticker = ? RETURNING *")
    .get(coin.name, coin.launched, coin.ticker) as CryptoCoin | undefined;
};

export const deleteItem = (ticker: string) => {
  return db.prepare("DELETE FROM crypto_coins WHERE ticker = ? RETURNING *")
    .get(ticker) as CryptoCoin | undefined;
};
