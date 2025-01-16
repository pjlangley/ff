use sqlite;
use std::fmt;

#[derive(Debug)]
pub struct CryptoCoin {
    id: i64,
    ticker: String,
    name: String,
    launched: i64,
}

impl fmt::Display for CryptoCoin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{{ id: {}, ticker: '{}', name: '{}', launched: {} }}",
            self.id, self.ticker, self.name, self.launched
        )
    }
}

fn init_db() -> Result<sqlite::Connection, sqlite::Error> {
    let connection = sqlite::open(":memory:")?;
    let query = "
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
    ";
    connection.execute(query)?;

    Ok(connection)
}

fn read_column<T>(
    stmt: &sqlite::Statement,
    index: usize,
    column_name: &str,
) -> Result<T, sqlite::Error>
where
    T: sqlite::ReadableWithIndex,
{
    stmt.read::<T, _>(index).map_err(|e| {
        eprintln!("Failed to read {} value from SQL row: {}", column_name, e);
        e
    })
}

pub fn get_item_by_ticker(ticker: &str) -> Result<Option<CryptoCoin>, sqlite::Error> {
    let query = "SELECT * FROM crypto_coins WHERE ticker = ? LIMIT 1";
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;
    stmt.bind((1, ticker))?;

    if let Ok(sqlite::State::Row) = stmt.next() {
        let id = read_column::<i64>(&stmt, 0, "id")?;
        let ticker = read_column::<String>(&stmt, 1, "ticker")?;
        let name = read_column::<String>(&stmt, 2, "name")?;
        let launched = read_column::<i64>(&stmt, 3, "launched")?;

        Ok(Some(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        }))
    } else {
        Ok(None)
    }
}

pub fn get_items_after_launch_year(launch_year: i64) -> Result<Vec<CryptoCoin>, sqlite::Error> {
    let query = "SELECT * FROM crypto_coins WHERE launched > ?";
    let mut coins = Vec::<CryptoCoin>::new();
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;
    stmt.bind((1, launch_year))?;

    loop {
        match stmt.next() {
            Ok(sqlite::State::Row) => {
                let id = read_column::<i64>(&stmt, 0, "id")?;
                let ticker = read_column::<String>(&stmt, 1, "ticker")?;
                let name = read_column::<String>(&stmt, 2, "name")?;
                let launched = read_column::<i64>(&stmt, 3, "launched")?;

                coins.push(CryptoCoin {
                    id,
                    ticker,
                    name,
                    launched,
                });
            }
            Ok(sqlite::State::Done) => break,
            Err(e) => {
                eprintln!("Failed to read SQL row: {}", e);
                return Err(e);
            }
        }
    }

    Ok(coins)
}

pub fn get_all_items() -> Result<Vec<CryptoCoin>, sqlite::Error> {
    let query = "SELECT * FROM crypto_coins ORDER BY launched DESC";
    let mut coins = Vec::<CryptoCoin>::new();
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;

    loop {
        match stmt.next() {
            Ok(sqlite::State::Row) => {
                let id = read_column::<i64>(&stmt, 0, "id")?;
                let ticker = read_column::<String>(&stmt, 1, "ticker")?;
                let name = read_column::<String>(&stmt, 2, "name")?;
                let launched = read_column::<i64>(&stmt, 3, "launched")?;

                coins.push(CryptoCoin {
                    id,
                    ticker,
                    name,
                    launched,
                });
            }
            Ok(sqlite::State::Done) => break,
            Err(e) => {
                eprintln!("Failed to read SQL row: {}", e);
                return Err(e);
            }
        }
    }

    Ok(coins)
}

pub fn add_item(ticker: &str, name: &str, launched: i64) -> Result<&'static str, sqlite::Error> {
    let query = "INSERT OR IGNORE INTO crypto_coins VALUES(NULL, :ticker, :name, :launched)";
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;
    stmt.bind(&[(":ticker", ticker), (":name", name)][..])?;
    stmt.bind((":launched", launched))?;
    stmt.next()?;
    Ok("ok")
}

pub fn update_item(
    ticker: &str,
    name: &str,
    launched: i64,
) -> Result<Option<CryptoCoin>, sqlite::Error> {
    let query = "UPDATE crypto_coins SET name = :name, launched = :launched WHERE ticker = :ticker RETURNING *";
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;
    stmt.bind(&[(":ticker", ticker), (":name", name)][..])?;
    stmt.bind((":launched", launched))?;

    if let Ok(sqlite::State::Row) = stmt.next() {
        let id = read_column::<i64>(&stmt, 0, "id")?;
        let ticker = read_column::<String>(&stmt, 1, "ticker")?;
        let name = read_column::<String>(&stmt, 2, "name")?;
        let launched = read_column::<i64>(&stmt, 3, "launched")?;

        Ok(Some(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        }))
    } else {
        Ok(None)
    }
}

pub fn delete_item(ticker: &str) -> Result<Option<CryptoCoin>, sqlite::Error> {
    let query = "DELETE FROM crypto_coins WHERE ticker = :ticker RETURNING *";
    let connection = init_db()?;
    let mut stmt = connection.prepare(query)?;
    stmt.bind((1, ticker))?;

    if let Ok(sqlite::State::Row) = stmt.next() {
        let id = read_column::<i64>(&stmt, 0, "id")?;
        let ticker = read_column::<String>(&stmt, 1, "ticker")?;
        let name = read_column::<String>(&stmt, 2, "name")?;
        let launched = read_column::<i64>(&stmt, 3, "launched")?;

        Ok(Some(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        }))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retrieves_known_ticker() {
        let result = get_item_by_ticker("BTC").unwrap();
        assert!(result.is_some());
        let coin = result.unwrap();
        assert_eq!(coin.ticker, "BTC");
        assert_eq!(coin.name, "Bitcoin");
        assert_eq!(coin.launched, 2009);
    }

    #[test]
    fn test_retrieves_unknown_ticker() {
        let result = get_item_by_ticker("XRP").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_matching_items_after_launch_year() {
        let result = get_items_after_launch_year(2000).unwrap();
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_no_matching_items_after_launch_year() {
        let result = get_items_after_launch_year(2020);
        assert!(result.is_ok_and(|x| x.len() == 0));
    }

    #[test]
    fn test_all_items_ordered_after_launch_year() {
        let coins = get_all_items().unwrap();
        assert_eq!(coins[0].ticker, "SOL");
        assert_eq!(coins[1].ticker, "ETH");
        assert_eq!(coins[2].ticker, "BTC");
    }

    #[test]
    fn test_add_item_success() {
        assert_eq!(add_item("PEPE", "Pepe", 2023).unwrap(), "ok");
    }

    #[test]
    fn test_update_item_success() {
        let result = update_item("BTC", "Bitcoin", 2008).unwrap();
        assert!(result.is_some());
        let coin = result.unwrap();
        assert_eq!(coin.ticker, "BTC");
        assert_eq!(coin.name, "Bitcoin");
        assert_eq!(coin.launched, 2008);
    }

    #[test]
    fn test_update_item_nonexistent() {
        let result = update_item("XRP", "Ripple", 2012).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_item_success() {
        let result = delete_item("ETH").unwrap();
        assert!(result.is_some());
        let coin = result.unwrap();
        assert_eq!(coin.ticker, "ETH");
        assert_eq!(coin.name, "Ethereum");
        assert_eq!(coin.launched, 2015);
    }

    #[test]
    fn test_delete_item_nonexistent() {
        let result = delete_item("XRP").unwrap();
        assert!(result.is_none());
    }
}
