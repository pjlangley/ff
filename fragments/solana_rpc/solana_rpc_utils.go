package solana_rpc

import (
	"context"
	"ff/env_vars"
	"log"
	"strings"

	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
)

func getRpcUrl() string {
	localhost := "http://127.0.0.1:8899"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	}

	return strings.Replace(localhost, "127.0.0.1", "solana-validator", 1)
}

func getRpcSubscriptionsUrl() string {
	localhost := "ws://127.0.0.1:8900"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	}

	return strings.Replace(localhost, "127.0.0.1", "solana-validator", 1)
}

func InitRpcClient() *rpc.Client {
	url := getRpcUrl()
	client := rpc.New(url)

	return client
}

func InitRpcSubscriptionsClient() *ws.Client {
	url := getRpcSubscriptionsUrl()
	client, clientErr := ws.Connect(context.Background(), url)

	if clientErr != nil {
		log.Fatalf("Failed to connect to WebSocket: %v", clientErr)
	}

	return client
}
