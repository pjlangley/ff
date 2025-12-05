package main

import (
	"context"
	"ff/env_vars"
	postgres_crud "ff/postgres_db"
	redis_crud "ff/redis_db"
	solana_airdrop "ff/solana_airdrop"
	solana_balance "ff/solana_balance"
	"ff/solana_rpc"
	sqlite_crud "ff/sqlite_db"
	"fmt"

	"github.com/gagliardetto/solana-go"

	api "ff/api/gin"
)

func main() {
	host := env_vars.GetEnvVar("GIN_HOST")
	if host == "" {
		host = "localhost"
	}
	addr := fmt.Sprintf("%s:3002", host)

	app := api.BuildApp()
	err := app.Run(addr)
	if err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		return
	}

	fmt.Printf("Server listening at %s\n", addr)
}

// todo will be removed once Api is fully implemented
func Run() {
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
	pgCoin, err := postgres_crud.GetItemByTicker("BTC")
	fmt.Println("fragment 'postgres_db/GetItemByTicker' output:", pgCoin, "Error:", err)

	pgCoins, err := postgres_crud.GetItemsAfterLaunchYear(2010)
	fmt.Println("fragment 'postgres_db/GetItemsAfterLaunchYear' output:", pgCoins, "Error:", err)

	pgAllCoins, err := postgres_crud.GetAllItems()
	fmt.Println("fragment 'postgres_db/GetAllItems' output:", pgAllCoins, "Error:", err)

	pgCreateItem, err := postgres_crud.CreateItem(postgres_crud.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023})
	fmt.Println("fragment 'postgres_db/CreateItem' output:", pgCreateItem, "Error:", err)

	pgUpdateCoin, err := postgres_crud.UpdateItem(postgres_crud.CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2009})
	fmt.Println("fragment 'postgres_db/UpdateItem' output:", pgUpdateCoin, "Error:", err)

	pgDeleteCoin, err := postgres_crud.DeleteItem("PEPE")
	fmt.Println("fragment 'postgres_db/DeleteItem' output:", pgDeleteCoin, "Error:", err)

	solanaKeypair, _ := solana.NewRandomPrivateKey()

	// solana balance
	solanaBalance, err := solana_balance.GetBalance(solanaKeypair.PublicKey())
	fmt.Println("fragment 'solana_balance/GetBalance' output:", solanaBalance, "Error:", err)

	// solana rpc
	solanaClient := solana_rpc.InitRpcClient()
	solanaClientVersionRes, err := solanaClient.GetVersion(context.Background())
	fmt.Println("fragment 'solana_rpc/InitRpcClient GetVersion' output:", solanaClientVersionRes, "Error:", err)

	// solana airdrop
	fmt.Println("fragment 'solana_airdrop/SendAndConfirmAirdrop' output:")
	solana_airdrop.SendAndConfirmAirdrop(solanaKeypair.PublicKey(), solana.LAMPORTS_PER_SOL)
}
