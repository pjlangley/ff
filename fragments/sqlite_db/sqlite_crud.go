package sqlite_crud

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

type CryptoCoin struct {
	id       int
	ticker   string
	name     string
	launched int
}

type CryptoCoinWithoutId struct {
	Ticker   string
	Name     string
	Launched int
}

func init_db() *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatal(err)
	}

	createTableQuery := `
		CREATE TABLE IF NOT EXISTS crypto_coins (
			id INTEGER PRIMARY KEY,
			ticker TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			launched INTEGER NOT NULL
		);`
	_, err = db.Exec(createTableQuery)

	if err != nil {
		log.Fatal("Failed to create table:", err)
	}

	tableSeed := `
		INSERT INTO crypto_coins VALUES
		(NULL, 'BTC', 'Bitcoin', 2009),
		(NULL, 'ETH', 'Ethereum', 2015),
		(NULL, 'SOL', 'Solana', 2020);`
	_, err = db.Exec(tableSeed)

	if err != nil {
		log.Fatal("Failed to seed crypto_coins table:", err)
	}

	return db
}

func GetItemByTicker(ticker string) *CryptoCoin {
	database := init_db()
	defer database.Close()
	query := `SELECT id, ticker, name, launched FROM crypto_coins WHERE ticker = ? LIMIT 1;`
	var coin CryptoCoin
	err := database.QueryRow(query, ticker).Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)
	switch {
	case err == sql.ErrNoRows:
		log.Printf("no coin with ticker %s", ticker)
		return nil
	case err != nil:
		log.Printf("Error querying coin: %v", err)
		return nil
	default:
		return &coin
	}
}

func GetItemsAfterLaunchYear(launch_year int) []CryptoCoin {
	database := init_db()
	defer database.Close()
	query := `SELECT * FROM crypto_coins WHERE launched > ?;`
	var coins []CryptoCoin
	rows, err := database.Query(query, launch_year)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var coin CryptoCoin
		err := rows.Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			return []CryptoCoin{}
		}
		coins = append(coins, coin)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating rows: %v", err)
		return []CryptoCoin{}
	}

	return coins
}

func GetAllItems() []CryptoCoin {
	database := init_db()
	defer database.Close()
	query := `SELECT * FROM crypto_coins ORDER BY launched DESC;`
	var coins []CryptoCoin
	rows, err := database.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var coin CryptoCoin
		err := rows.Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			return []CryptoCoin{}
		}
		coins = append(coins, coin)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating rows: %v", err)
		return []CryptoCoin{}
	}

	return coins
}

func AddItem(coin CryptoCoinWithoutId) (string, int64) {
	database := init_db()
	defer database.Close()
	query := `INSERT INTO crypto_coins VALUES(NULL, ?, ?, ?);`
	result, err := database.Exec(query, coin.Ticker, coin.Name, coin.Launched)
	if err != nil {
		log.Fatal("Failed to add coin to crypto_coins table:", err)
	}
	newId, err := result.LastInsertId()
	if err != nil {
		log.Fatal("Failed to retrieve last insert ID:", err)
	}

	return "ok", newId
}
