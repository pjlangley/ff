import sqlite3
from typing import Optional, Tuple, List, Literal

CryptoCoin = Tuple[int, str, str, int]


def init_db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    cursor = connection.cursor()
    cursor.execute(
        """
    CREATE TABLE IF NOT EXISTS crypto_coins (
      id INTEGER PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      launched INTEGER NOT NULL
    );
 """
    )
    cursor.execute(
        """
    INSERT INTO crypto_coins VALUES
    (NULL, 'BTC', 'Bitcoin', 2009),
    (NULL, 'ETH', 'Ethereum', 2015),
    (NULL, 'SOL', 'Solana', 2020);
 """
    )
    connection.commit()
    return connection


def get_item_by_ticker(ticker: str) -> Optional[CryptoCoin]:
    connection = init_db()
    cursor = connection.cursor()
    params = (ticker,)
    cursor.execute("SELECT * FROM crypto_coins WHERE ticker = ? LIMIT 1", params)
    result = cursor.fetchone()
    connection.close()

    return result if result is None else tuple(result)


def get_items_after_launch_year(launch_year: int) -> List[CryptoCoin]:
    connection = init_db()
    cursor = connection.cursor()
    params = (launch_year,)
    cursor.execute("SELECT * FROM crypto_coins WHERE launched > ?", params)
    result = cursor.fetchall()
    connection.close()

    return result


def get_all_items() -> List[CryptoCoin]:
    connection = init_db()
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM crypto_coins ORDER BY launched DESC")
    result = cursor.fetchall()
    connection.close()

    return result


def add_item(coin: Tuple[str, str, int]) -> Literal["ok"]:
    ticker = coin[0]
    name = coin[1]
    launched = coin[2]
    connection = init_db()
    cursor = connection.cursor()
    params = (ticker, name, launched)
    cursor.execute("INSERT OR IGNORE INTO crypto_coins VALUES(NULL, ?, ?, ?)", params)
    connection.commit()
    connection.close()

    return "ok"
