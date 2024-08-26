use sqlite;
use std::fmt;

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

fn read_column<T>(stmt: &sqlite::Statement, index: usize, column_name: &str) -> Option<T>
where
    T: sqlite::ReadableWithIndex,
{
    match stmt.read::<T, _>(index) {
        Ok(value) => Some(value),
        Err(e) => {
            eprintln!("Failed to read {} value from SQL row: {}", column_name, e);
            None
        }
    }
}

pub fn get_item_by_ticker(ticker: &str) -> Option<CryptoCoin> {
    let query = "SELECT * FROM crypto_coins WHERE ticker = ? LIMIT 1";
    let connection = match init_db() {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("Failed to initialise database: {}", e);
            return None;
        }
    };

    let mut stmt = match connection.prepare(query) {
        Ok(statement) => statement,
        Err(e) => {
            eprintln!("Failed to prepare SQL statement: {}", e);
            return None;
        }
    };

    match stmt.bind((1, ticker)) {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Failed to bind value to SQL statement: {}", e);
            return None;
        }
    }

    if let Ok(sqlite::State::Row) = stmt.next() {
        let id = read_column::<i64>(&stmt, 0, "id")?;
        let ticker = read_column::<String>(&stmt, 1, "ticker")?;
        let name = read_column::<String>(&stmt, 2, "name")?;
        let launched = read_column::<i64>(&stmt, 3, "launched")?;

        Some(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        })
    } else {
        None
    }
}

pub fn get_items_after_launch_year(launch_year: i64) -> Option<Vec<CryptoCoin>> {
    let query = "SELECT * FROM crypto_coins WHERE launched > ?";
    let mut coins = Vec::<CryptoCoin>::new();
    let connection = match init_db() {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("Failed to initialise database: {}", e);
            return None;
        }
    };
    let mut stmt = match connection.prepare(query) {
        Ok(statement) => statement,
        Err(e) => {
            eprintln!("Failed to prepare SQL statement: {}", e);
            return None;
        }
    };

    match stmt.bind((1, launch_year)) {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Failed to bind value to SQL statement: {}", e);
            return None;
        }
    }

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
                return None;
            }
        }
    }

    Some(coins)
}

pub fn get_all_items() -> Option<Vec<CryptoCoin>> {
    let query = "SELECT * FROM crypto_coins ORDER BY launched DESC";
    let mut coins = Vec::<CryptoCoin>::new();
    let connection = match init_db() {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("Failed to initialise database: {}", e);
            return None;
        }
    };
    let mut stmt = match connection.prepare(query) {
        Ok(statement) => statement,
        Err(e) => {
            eprintln!("Failed to prepare SQL statement: {}", e);
            return None;
        }
    };

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
                return None;
            }
        }
    }

    Some(coins)
}

pub fn add_item(ticker: &str, name: &str, launched: i64) -> Option<&'static str> {
    let query = "INSERT INTO crypto_coins VALUES(NULL, :ticker, :name, :launched)";
    let connection = match init_db() {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("Failed to initialise database: {}", e);
            return None;
        }
    };
    let mut stmt = match connection.prepare(query) {
        Ok(statement) => statement,
        Err(e) => {
            eprintln!("Failed to prepare SQL statement: {}", e);
            return None;
        }
    };

    match stmt.bind(&[(":ticker", ticker), (":name", name)][..]) {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Failed to bind value to SQL statement: {}", e);
            return None;
        }
    }
    match stmt.bind((":launched", launched)) {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Failed to bind value to SQL statement: {}", e);
            return None;
        }
    }

    match stmt.next() {
        Ok(_) => Some("ok"),
        Err(e) => {
            eprintln!("Failed to into item into database: {}", e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retrieves_known_ticker() {
        let result = get_item_by_ticker("BTC");
        assert!(result.is_some());
        let coin = result.unwrap();
        assert_eq!(coin.ticker, "BTC");
        assert_eq!(coin.name, "Bitcoin");
        assert_eq!(coin.launched, 2009);
    }

    #[test]
    fn test_retrieves_unknown_ticker() {
        let result = get_item_by_ticker("XRP");
        assert!(result.is_none());
    }

    #[test]
    fn test_matching_items_after_launch_year() {
        let result = get_items_after_launch_year(2000);
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 3);
    }

    #[test]
    fn test_no_matching_items_after_launch_year() {
        let result = get_items_after_launch_year(2020);
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_all_items_ordered_after_launch_year() {
        let result = get_all_items();
        assert!(result.is_some());
        let coins = result.unwrap();
        assert_eq!(coins[0].ticker, "SOL");
        assert_eq!(coins[1].ticker, "ETH");
        assert_eq!(coins[2].ticker, "BTC");
    }

    #[test]
    fn test_add_item_success() {
        let result = add_item("PEPE", "Pepe", 2023);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "ok");
    }

    #[test]
    fn test_add_item_failure() {
        let result = add_item("BTC", "Bitcoin", 2009);
        assert!(result.is_none());
    }
}
