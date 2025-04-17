package solana_rpc

import (
	"context"
	"testing"

	"github.com/gagliardetto/solana-go/rpc"
)

var ctx = context.Background()

func TestSolanaInitRpcClient(t *testing.T) {
	client := InitRpcClient()

	blockHeight, err := client.GetBlockHeight(ctx, rpc.CommitmentConfirmed)

	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}

	if blockHeight < 1 {
		t.Errorf("Expected block height to be greater than 0, but got %d", blockHeight)
	}
}
