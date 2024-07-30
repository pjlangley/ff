import { Database } from "sqlite3";

interface CryptoCoin {
  id: number;
  ticker: string;
  name: string;
  launched: number;
}

type CryptoCoinRecord = Record<keyof CryptoCoin, CryptoCoin[keyof CryptoCoin]>;

const init_db = () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS crypto_coins (
      id INTEGER PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      launched INTEGER NOT NULL
    );
  `);
  db.exec(`
    INSERT INTO crypto_coins VALUES
    (NULL, 'BTC', 'Bitcoin', 2009),
    (NULL, 'ETH', 'Ethereum', 2015),
    (NULL, 'SOL', 'Solana', 2020);
  `);

  return db;
};

export const get_item_by_ticker = (ticker: string) => {
  const db = init_db();
  const stmt = db.prepare("SELECT * FROM crypto_coins WHERE ticker = ?");
  const result = stmt.get<CryptoCoinRecord>(ticker);
  db.close();

  return result;
};

export const get_items_after_launch_year = async (launch_year: number) => {
  const db = init_db();
  const result = await db.sql<CryptoCoinRecord>`SELECT * FROM crypto_coins WHERE launched > ${launch_year}`;
  db.close();

  return result;
};

export const get_all_items = async () => {
  const db = init_db();
  const result = await db.sql<CryptoCoinRecord>`SELECT * FROM crypto_coins ORDER BY launched DESC`;
  db.close();

  return result;
};

export const add_item = (coin: Omit<CryptoCoin, "id">) => {
  const db = init_db();
  const stmt = db.prepare("INSERT INTO crypto_coins VALUES(NULL, :ticker, :name, :launched)");
  const result = stmt.run({ ticker: coin.ticker, name: coin.name, launched: coin.launched });
  db.close();

  return result;
};
