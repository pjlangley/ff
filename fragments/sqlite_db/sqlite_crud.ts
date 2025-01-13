import { verbose as sqlite3 } from "sqlite3";

const sqlite = sqlite3();

const INIT_DB_SQL = `
CREATE TABLE IF NOT EXISTS crypto_coins (
  id INTEGER PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  launched INTEGER NOT NULL
);
`;

const DB_SEED_SQL = `
INSERT INTO crypto_coins VALUES
(NULL, 'BTC', 'Bitcoin', 2009),
(NULL, 'ETH', 'Ethereum', 2015),
(NULL, 'SOL', 'Solana', 2020);
`;

interface CryptoCoin {
  id: number;
  ticker: string;
  name: string;
  launched: number;
}

const initDb = async () => {
  const db = new sqlite.Database(":memory:");

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(INIT_DB_SQL, [], (err) => {
          if (err) reject(err);
        });

        db.run(DB_SEED_SQL, [], (err) => {
          if (err) reject(err);
          resolve({});
        });
      });
    });
  } catch (e) {
    console.error(e);
    throw new Error("init_db sql failed!");
  }

  return db;
};

export const getItemByTicker = async (ticker: string) => {
  const db = await initDb();
  const result = await new Promise<CryptoCoin | undefined>((resolve, reject) => {
    db.get<CryptoCoin | undefined>("SELECT * FROM crypto_coins WHERE ticker = ? LIMIT 1", [ticker], (err, row) => {
      if (err) {
        reject(err);
      }
      resolve(row);
    });
  });

  return result;
};

export const getItemsAfterLaunchYear = async (launchYear: number) => {
  const db = await initDb();
  const result = await new Promise<CryptoCoin[]>((resolve, reject) => {
    db.all<CryptoCoin>("SELECT * FROM crypto_coins WHERE launched > ?", [launchYear], (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });

  return result;
};

export const getAllItems = async () => {
  const db = await initDb();
  const result = await new Promise<CryptoCoin[]>((resolve, reject) => {
    db.all<CryptoCoin>("SELECT * FROM crypto_coins ORDER BY launched DESC", [], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });

  return result;
};

export const addItem = async (coin: Omit<CryptoCoin, "id">) => {
  const db = await initDb();
  const result = await new Promise<string>((resolve, reject) => {
    db.run(
      "INSERT OR IGNORE INTO crypto_coins VALUES(NULL, ?1, ?2, ?3)",
      { 1: coin.ticker, 2: coin.name, 3: coin.launched },
      (err) => {
        if (err) reject(err);
        resolve("ok");
      },
    );
  });

  return result;
};

export const updateItem = async (coin: Omit<CryptoCoin, "id">) => {
  const db = await initDb();
  const result = await new Promise<CryptoCoin | undefined>((resolve, reject) => {
    db.get<CryptoCoin | undefined>(
      "UPDATE crypto_coins SET name = ?1, launched = ?2 WHERE ticker = ?3 RETURNING *",
      {
        1: coin.name,
        2: coin.launched,
        3: coin.ticker,
      },
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      },
    );
  });

  return result;
};

export const deleteItem = async (ticker: string) => {
  const db = await initDb();
  const result = await new Promise<CryptoCoin | undefined>((resolve, reject) => {
    db.get<CryptoCoin | undefined>("DELETE FROM crypto_coins WHERE ticker = ? RETURNING *", [ticker], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });

  return result;
};
