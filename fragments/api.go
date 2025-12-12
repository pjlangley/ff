package main

import (
	"context"
	"ff/env_vars"
	redis_crud "ff/redis_db"
	solana_airdrop "ff/solana_airdrop"
	solana_balance "ff/solana_balance"
	"ff/solana_rpc"
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
	// redis
	fmt.Println("fragment 'redis_db/ping' output:", redis_crud.RedisPing())
	fmt.Println("fragment 'redis_db/create' output:", redis_crud.RedisCreate("go", "bitcoin"))
	fmt.Println("fragment 'redis_db/read' output:", redis_crud.RedisRead("go"))
	fmt.Println("fragment 'redis_db/update' output:", redis_crud.RedisUpdate("go", "pepe"))
	fmt.Println("fragment 'redis_db/delete' output:", redis_crud.RedisDelete("go"))

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
