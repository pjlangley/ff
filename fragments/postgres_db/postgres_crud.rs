use crate::env_vars::env_vars_utils::get_env_var;
use postgres::{Client, Error, NoTls};
use std::fmt;

#[derive(Debug)]
pub struct CryptoCoin {
    id: i32,
    ticker: String,
    name: String,
    launched: i16,
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

fn init_client() -> Result<Client, Error> {
    let params = if get_env_var("CI").is_empty() {
        "host=localhost user=postgres password=pgpass"
    } else {
        "host=postgres user=postgres password=pgpass"
    };
    let mut client = Client::connect(params, NoTls)?;
    client.batch_execute(
        "
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
  ",
    )?;

    Ok(client)
}

pub fn get_item_by_ticker(ticker: &str) -> Result<Option<CryptoCoin>, Error> {
    let query = "SELECT * FROM crypto_coins WHERE ticker = $1 LIMIT 1";
    let mut client = init_client()?;
    let row = client.query_opt(query, &[&ticker])?;

    match row {
        Some(row) => {
            let id: i32 = row.get("id");
            let ticker: String = row.get("ticker");
            let name: String = row.get("name");
            let launched: i16 = row.get("launched");
            Ok(Some(CryptoCoin {
                id,
                ticker,
                name,
                launched,
            }))
        }
        None => Ok(None),
    }
}

pub fn get_items_after_launch_year(launch_year: i16) -> Result<Vec<CryptoCoin>, Error> {
    let query = "SELECT * FROM crypto_coins WHERE launched > $1";
    let mut client = init_client()?;
    let mut coins = Vec::<CryptoCoin>::new();

    for row in client.query(query, &[&launch_year])? {
        let id: i32 = row.get("id");
        let ticker: String = row.get("ticker");
        let name: String = row.get("name");
        let launched: i16 = row.get("launched");
        coins.push(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        });
    }

    Ok(coins)
}

pub fn get_all_items() -> Result<Vec<CryptoCoin>, Error> {
    let query = "SELECT * FROM crypto_coins ORDER BY launched DESC";
    let mut client = init_client()?;
    let mut coins = Vec::<CryptoCoin>::new();

    for row in client.query(query, &[])? {
        let id: i32 = row.get("id");
        let ticker: String = row.get("ticker");
        let name: String = row.get("name");
        let launched: i16 = row.get("launched");
        coins.push(CryptoCoin {
            id,
            ticker,
            name,
            launched,
        });
    }

    Ok(coins)
}

pub fn add_item(ticker: &str, name: &str, launched: i16) -> Result<&'static str, Error> {
    let query = "INSERT INTO crypto_coins (ticker, name, launched) VALUES($1, $2, $3) ON CONFLICT (ticker) DO NOTHING";
    let mut client = init_client()?;
    client.execute(query, &[&ticker, &name, &launched])?;

    Ok("ok")
}

pub fn update_item(ticker: &str, name: &str, launched: i16) -> Result<Option<CryptoCoin>, Error> {
    let query = "UPDATE crypto_coins SET name = $1, launched = $2 WHERE ticker = $3 RETURNING *";
    let mut client = init_client()?;
    let row = client.query_opt(query, &[&name, &launched, &ticker])?;

    match row {
        Some(row) => {
            let id: i32 = row.get("id");
            let ticker: String = row.get("ticker");
            let name: String = row.get("name");
            let launched: i16 = row.get("launched");
            Ok(Some(CryptoCoin {
                id,
                ticker,
                name,
                launched,
            }))
        }
        None => Ok(None),
    }
}

pub fn delete_item(ticker: &str) -> Result<Option<CryptoCoin>, Error> {
    let query = "DELETE FROM crypto_coins WHERE ticker = $1 RETURNING *";
    let mut client = init_client()?;
    let row = client.query_opt(query, &[&ticker])?;

    match row {
        Some(row) => {
            let id: i32 = row.get("id");
            let ticker: String = row.get("ticker");
            let name: String = row.get("name");
            let launched: i16 = row.get("launched");
            Ok(Some(CryptoCoin {
                id,
                ticker,
                name,
                launched,
            }))
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reads_known_ticker() {
        let result = get_item_by_ticker("BTC").unwrap();
        assert!(result.is_some());
        let coin = result.unwrap();
        assert_eq!(coin.ticker, "BTC");
        assert_eq!(coin.name, "Bitcoin");
        assert_eq!(coin.launched, 2009);
    }

    #[test]
    fn test_reads_unknown_ticker() {
        let result = get_item_by_ticker("ADA").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_reads_items_after_launch_year() {
        let result = get_items_after_launch_year(2010).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_reads_no_items_after_launch_year() {
        let result = get_items_after_launch_year(2025).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_items_after_launch_year_results_ordered() {
        let result = get_all_items().unwrap();
        assert_eq!(result[0].ticker, "SOL");
        assert_eq!(result[1].ticker, "ETH");
        assert_eq!(result[2].ticker, "BTC");
    }

    #[test]
    fn test_add_new_item() {
        use std::panic;

        let result = panic::catch_unwind(|| {
            let result = add_item("FAKE", "Fakecoin", 2008).unwrap();
            assert_eq!(result, "ok");
        });

        if let Err(err) = delete_item("FAKE") {
            eprintln!("Failed to delete item during cleanup: {:?}", err);
        }

        if let Err(err) = result {
            panic::resume_unwind(err);
        }
    }

    #[test]
    fn test_add_existing_item() {
        let result = add_item("BTC", "Bitcoin", 2009).unwrap();
        assert_eq!(result, "ok");
    }

    #[test]
    fn test_delete_item() {
        let add_result = add_item("FAKE2", "Fakecoin2", 2008).unwrap();
        assert_eq!(add_result, "ok");

        let delete_result = delete_item("FAKE2").unwrap();
        assert_eq!(delete_result.unwrap().name, "Fakecoin2");
    }

    #[test]
    fn test_update_item() {
        let result = update_item("BTC", "Bitcoin", 2009).unwrap();
        assert_eq!(result.unwrap().name, "Bitcoin");
    }

    #[test]
    fn test_update_nonexistent_item() {
        let result = update_item("UNKNOWN", "Unknown", 2000).unwrap();
        assert!(result.is_none());
    }
}
