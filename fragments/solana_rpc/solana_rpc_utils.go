package solana_rpc

import (
	"context"
	"ff/env_vars"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
)

func getRpcUrl() string {
	localhost := "http://127.0.0.1:8899"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	}

	return strings.Replace(localhost, "127.0.0.1", "solana", 1)
}

func getRpcSubscriptionsUrl() string {
	localhost := "ws://127.0.0.1:8900"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	}

	return strings.Replace(localhost, "127.0.0.1", "solana", 1)
}

func InitRpcClient() *rpc.Client {
	url := getRpcUrl()
	client := rpc.New(url)

	return client
}

func InitRpcSubscriptionsClient() *ws.Client {
	url := getRpcSubscriptionsUrl()
	client, err := ws.Connect(context.Background(), url)

	if err != nil {
		log.Fatalf("Failed to connect to WebSocket: %v", err)
	}

	return client
}

func WaitForSlot(slot uint64, timeout *uint64) (bool, error) {
	client := InitRpcClient()
	to := uint64(5000)
	if timeout != nil {
		to = *timeout
	}
	deadline := time.Now().Add(time.Duration(to) * time.Millisecond)

	for {
		currentSlot, err := client.GetSlot(context.Background(), rpc.CommitmentConfirmed)
		if err != nil {
			return false, fmt.Errorf("GetSlot failed %v", err)
		}
		if currentSlot >= slot {
			return true, nil
		}
		if time.Now().After(deadline) {
			return false, nil
		}

		time.Sleep(200 * time.Millisecond)
	}
}
