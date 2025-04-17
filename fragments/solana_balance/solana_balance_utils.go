package solana_balance

import (
	"context"
	"ff/solana_rpc"
	"fmt"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

var ctx = context.Background()

func GetBalance(address solana.PublicKey) (uint64, error) {
	client := solana_rpc.InitRpcClient()

	balance, err := client.GetBalance(ctx, address, rpc.CommitmentConfirmed)

	if err != nil {
		return 0, fmt.Errorf("failed to get balance: %w", err)
	}

	return balance.Value, nil
}
