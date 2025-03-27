package main

import (
	"ff/env_vars"
	postgres_crud "ff/postgres_db"
	redis_crud "ff/redis_db"
	solana_key_pair_utils "ff/solana_key_pair"
	sqlite_crud "ff/sqlite_db"
	"fmt"
)

func main() {
	// env vars
	fmt.Println("fragment 'env_vars' output:", env_vars.GetEnvVar("REPO_NAME"))

	// sqlite
	fmt.Println("fragment 'sqlite_db/GetItemByTicker' output:", sqlite_crud.GetItemByTicker("BTC"))
	fmt.Println("fragment 'sqlite_db/GetItemsAfterLaunchYear' output:", sqlite_crud.GetItemsAfterLaunchYear(2010))
	fmt.Println("fragment 'sqlite_db/GetAllItems' output:", sqlite_crud.GetAllItems())

	sqliteOk, sqliteNewId := sqlite_crud.AddItem(sqlite_crud.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023})
	fmt.Printf("fragment 'sqlite_db/AddItem' output: ok=%s, newId=%d\n", sqliteOk, sqliteNewId)

	fmt.Println("fragment 'sqlite_db/UpdateItem' output:", sqlite_crud.UpdateItem(sqlite_crud.CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2008}))
	fmt.Println("fragment 'sqlite_db/DeleteItem' output:", sqlite_crud.DeleteItem("ETH"))

	// redis
	fmt.Println("fragment 'redis_db/ping' output:", redis_crud.RedisPing())
	fmt.Println("fragment 'redis_db/create' output:", redis_crud.RedisCreate("go", "bitcoin"))
	fmt.Println("fragment 'redis_db/read' output:", redis_crud.RedisRead("go"))
	fmt.Println("fragment 'redis_db/update' output:", redis_crud.RedisUpdate("go", "pepe"))
	fmt.Println("fragment 'redis_db/delete' output:", redis_crud.RedisDelete("go"))

	// postgres
	pgCoin, pgCoinErr := postgres_crud.GetItemByTicker("BTC")
	fmt.Println("fragment 'postgres_db/GetItemByTicker' output:", pgCoin, "Error:", pgCoinErr)

	pgCoins, pgCoinsErr := postgres_crud.GetItemsAfterLaunchYear(2010)
	fmt.Println("fragment 'postgres_db/GetItemsAfterLaunchYear' output:", pgCoins, "Error:", pgCoinsErr)

	pgAllCoins, pgAllCoinsErr := postgres_crud.GetAllItems()
	fmt.Println("fragment 'postgres_db/GetAllItems' output:", pgAllCoins, "Error:", pgAllCoinsErr)

	pgCreateItem, pgCreateItemErr := postgres_crud.CreateItem(postgres_crud.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023})
	fmt.Println("fragment 'postgres_db/CreateItem' output:", pgCreateItem, "Error:", pgCreateItemErr)

	pgUpdateCoin, pgUpdateCoinErr := postgres_crud.UpdateItem(postgres_crud.CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2009})
	fmt.Println("fragment 'postgres_db/UpdateItem' output:", pgUpdateCoin, "Error:", pgUpdateCoinErr)

	pgDeleteCoin, pgDeleteCoinErr := postgres_crud.DeleteItem("PEPE")
	fmt.Println("fragment 'postgres_db/DeleteItem' output:", pgDeleteCoin, "Error:", pgDeleteCoinErr)

	// solana key pair
	solanaKeypair, solanaKeypairErr := solana_key_pair_utils.CreateKeyPair()
	fmt.Println("fragment 'solana_key_pair/CreateKeyPair' output:", solanaKeypair, "Error:", solanaKeypairErr)
	fmt.Println("fragment 'solana_key_pair/GetAddress' output:", solana_key_pair_utils.GetAddress(solanaKeypair))
}
