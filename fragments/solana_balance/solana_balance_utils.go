package solana_balance_utils

import (
	"context"
	"ff/env_vars"
	"fmt"
	"strings"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

var ctx = context.Background()

func getRpcUrl() string {
	localhost := "http://127.0.0.1:8899"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	} else {
		return strings.Replace(localhost, "127.0.0.1", "solana-validator", 1)
	}
}

func GetBalance(address solana.PublicKey) (uint64, error) {
	url := getRpcUrl()
	client := rpc.New(url)

	balance, err := client.GetBalance(ctx, address, rpc.CommitmentConfirmed)

	if err != nil {
		return 0, fmt.Errorf("failed to get balance: %w", err)
	}

	return balance.Value, nil
}
