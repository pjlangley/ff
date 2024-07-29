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

const init_db = async () => {
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

export const get_item_by_ticker = async (ticker: string) => {
  const db = await init_db();
  const result = await new Promise<CryptoCoin | undefined>(
    (resolve, reject) => {
      db.get<CryptoCoin | undefined>(
        "SELECT * FROM crypto_coins WHERE ticker = ?",
        [ticker],
        (err, row) => {
          if (err) {
            reject(err);
          }
          resolve(row);
        },
      );
    },
  );

  return result;
};

export const get_items_after_launch_year = async (launch_year: number) => {
  const db = await init_db();
  const result = await new Promise<CryptoCoin[]>((resolve, reject) => {
    db.all<CryptoCoin>(
      "SELECT * FROM crypto_coins WHERE launched > ?",
      [launch_year],
      (err, rows) => {
        if (err) {
          reject(err);
        }
        resolve(rows);
      },
    );
  });

  return result;
};

export const get_all_items = async () => {
  const db = await init_db();
  const result = await new Promise<CryptoCoin[]>((resolve, reject) => {
    db.all<CryptoCoin>(
      "SELECT * FROM crypto_coins ORDER BY launched DESC",
      [],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      },
    );
  });

  return result;
};

export const add_item = async (coin: Omit<CryptoCoin, "id">) => {
  const db = await init_db();
  const result = await new Promise<string>((resolve, reject) => {
    db.run(
      "INSERT INTO crypto_coins VALUES(NULL, ?1, ?2, ?3)",
      { 1: coin.ticker, 2: coin.name, 3: coin.launched },
      (err) => {
        if (err) reject(err);
        resolve("ok");
      },
    );
  });

  return result;
};
