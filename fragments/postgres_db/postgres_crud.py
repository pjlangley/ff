from typing import Optional, Tuple, List, Literal
import psycopg
from fragments.env_vars import get_env_var

CryptoCoin = Tuple[int, str, str, int]


def get_connection_string() -> str:
    connection_string = "postgres://postgres:pgpass@localhost:5432"

    if get_env_var("CI") is None:
        return connection_string

    return connection_string.replace("localhost", "postgres")


def init_db() -> psycopg.Connection:
    connection = psycopg.connect(get_connection_string())
    cursor = connection.cursor()
    cursor.execute(
        """
    CREATE TABLE IF NOT EXISTS crypto_coins (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(8) NOT NULL UNIQUE,
      name VARCHAR(30) NOT NULL,
      launched SMALLINT NOT NULL
    );
    INSERT INTO crypto_coins (ticker, name, launched) VALUES
    ('BTC', 'Bitcoin', 2009),
    ('ETH', 'Ethereum', 2015),
    ('SOL', 'Solana', 2020)
    ON CONFLICT (ticker) DO NOTHING; 
    """
    )
    connection.commit()

    return connection


def get_item_by_ticker(ticker: str) -> Optional[CryptoCoin]:
    connection = init_db()
    cursor = connection.execute("SELECT * FROM crypto_coins WHERE ticker = %s LIMIT 1", (ticker,))
    connection.close()

    return cursor.fetchone()


def get_items_after_launch_year(launch_year: int) -> List[CryptoCoin]:
    connection = init_db()
    cursor = connection.execute("SELECT * FROM crypto_coins WHERE launched > %s", (launch_year,))
    connection.close()

    return cursor.fetchall()


def get_all_items() -> List[CryptoCoin]:
    connection = init_db()
    cursor = connection.execute("SELECT * FROM crypto_coins ORDER BY launched DESC")
    connection.close()

    return cursor.fetchall()


def add_item(coin: Tuple[str, str, int]) -> Literal["ok"]:
    ticker = coin[0]
    name = coin[1]
    launched = coin[2]
    connection = init_db()
    connection.execute(
        "INSERT INTO crypto_coins (ticker, name, launched) VALUES(%s, %s, %s) ON CONFLICT (ticker) DO NOTHING;",
        (
            ticker,
            name,
            launched,
        ),
    )
    connection.commit()
    connection.close()

    return "ok"


def remove_item(ticker: str) -> Optional[CryptoCoin]:
    connection = init_db()
    cursor = connection.execute(
        "DELETE FROM crypto_coins WHERE ticker = %s RETURNING ticker, name, launched",
        (ticker,),
    )
    connection.commit()
    connection.close()

    return cursor.fetchone()


def update_item(coin: Tuple[str, str, int]) -> Optional[CryptoCoin]:
    ticker = coin[0]
    name = coin[1]
    launched = coin[2]
    connection = init_db()
    cursor = connection.execute(
        "UPDATE crypto_coins SET name = %s, launched = %s WHERE ticker = %s RETURNING ticker, name, launched",
        (
            name,
            launched,
            ticker,
        ),
    )
    connection.commit()
    connection.close()

    return cursor.fetchone()
