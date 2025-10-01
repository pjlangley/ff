package postgres_crud

import (
	"context"
	"ff/env_vars"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
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

var ctx = context.Background()

func getConnectionString() string {
	localhost := "postgres://postgres:pgpass@localhost:5432"
	host := env_vars.GetEnvVar("POSTGRES_HOST")

	if len(host) == 0 {
		return localhost
	} else {
		return strings.Replace(localhost, "localhost", host, 1)
	}
}

func initDb() *pgx.Conn {
	conn, err := pgx.Connect(ctx, getConnectionString())
	if err != nil {
		log.Fatal("Unable to connect to Postgres", err)
	}
	_, err = conn.Exec(ctx, `
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
	`)
	if err != nil {
		log.Fatal("Error executing setup queries", err)
	}

	return conn
}

func GetItemByTicker(ticker string) (*CryptoCoin, error) {
	var coin CryptoCoin
	conn := initDb()
	defer conn.Close(ctx)
	err := conn.QueryRow(ctx,
		"SELECT * FROM crypto_coins WHERE ticker = $1 LIMIT 1",
		ticker,
	).Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("query failed: %w", err)
	}

	return &coin, nil
}

func GetItemsAfterLaunchYear(launchYear int) ([]CryptoCoin, error) {
	var coins []CryptoCoin
	conn := initDb()
	defer conn.Close(ctx)
	rows, queryErr := conn.Query(ctx, "SELECT * FROM crypto_coins WHERE launched > $1", launchYear)
	if queryErr != nil {
		return nil, fmt.Errorf("get items after launch year query failed: %w", queryErr)
	}

	defer rows.Close()

	for rows.Next() {
		var coin CryptoCoin
		err := rows.Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)
		if err != nil {
			return nil, fmt.Errorf("Error scanning row: %w", err)
		}
		coins = append(coins, coin)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("row iteration error: %w", rows.Err())
	}

	return coins, nil
}

func GetAllItems() ([]CryptoCoin, error) {
	var coins []CryptoCoin
	conn := initDb()
	defer conn.Close(ctx)
	rows, queryErr := conn.Query(ctx, "SELECT * FROM crypto_coins ORDER BY launched DESC")
	if queryErr != nil {
		return nil, fmt.Errorf("get all items failed: %w", queryErr)
	}

	defer rows.Close()

	for rows.Next() {
		var coin CryptoCoin
		err := rows.Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)
		if err != nil {
			return nil, fmt.Errorf("error scanning row: %w", err)
		}
		coins = append(coins, coin)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("row iteration error: %w", rows.Err())
	}

	return coins, nil
}

func CreateItem(coin CryptoCoinWithoutId) (string, error) {
	var query = "INSERT INTO crypto_coins (ticker, name, launched) VALUES($1, $2, $3) ON CONFLICT (ticker) DO NOTHING"
	conn := initDb()
	defer conn.Close(ctx)
	_, err := conn.Exec(ctx, query, coin.Ticker, coin.Name, coin.Launched)
	if err != nil {
		return "", fmt.Errorf("create item failed: %w", err)
	}

	return "ok", nil
}

func UpdateItem(coin CryptoCoinWithoutId) (*CryptoCoin, error) {
	var result CryptoCoin
	var query = "UPDATE crypto_coins SET name = $1, launched = $2 WHERE ticker = $3 RETURNING *"
	conn := initDb()
	defer conn.Close(ctx)
	err := conn.QueryRow(ctx,
		query,
		coin.Name, coin.Launched, coin.Ticker,
	).Scan(&result.id, &result.ticker, &result.name, &result.launched)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("update item query failed: %w", err)
	}

	return &result, nil
}

func DeleteItem(ticker string) (*CryptoCoin, error) {
	var coin CryptoCoin
	var query = "DELETE FROM crypto_coins WHERE ticker = $1 RETURNING *"
	conn := initDb()
	defer conn.Close(ctx)
	err := conn.QueryRow(ctx,
		query,
		ticker,
	).Scan(&coin.id, &coin.ticker, &coin.name, &coin.launched)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("delete item query failed: %w", err)
	}

	return &coin, nil
}
