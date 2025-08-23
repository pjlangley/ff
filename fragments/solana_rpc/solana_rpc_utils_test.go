package solana_rpc

import (
	"context"
	"testing"
	"time"

	"github.com/gagliardetto/solana-go/rpc"
)

func TestSolanaInitRpcClient(t *testing.T) {
	client := InitRpcClient()

	blockHeight, err := client.GetBlockHeight(context.Background(), rpc.CommitmentConfirmed)

	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}

	if blockHeight < 1 {
		t.Errorf("Expected block height to be greater than 0, but got %d", blockHeight)
	}
}

func TestSolanaInitRpcSubscriptionsClient(t *testing.T) {
	client := InitRpcSubscriptionsClient()

	sub, err := client.SlotSubscribe()
	if err != nil {
		t.Fatalf("Failed to subscribe to slots: %v", err)
	}
	defer sub.Unsubscribe()

	ctxWithTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	slot, err := sub.Recv(ctxWithTimeout)

	if err != nil {
		t.Fatalf("Failed to receive slot update: %v", err)
	}

	if slot.Slot < 1 {
		t.Errorf("Expected slot to be greater than 0, but got %d", slot.Slot)
	}
}

func TestSolanaWaitForSlot_SlotReached(t *testing.T) {
	client := InitRpcClient()
	recentSlot, err := client.GetSlot(context.Background(), rpc.CommitmentConfirmed)
	if err != nil {
		t.Fatalf("GetSlot failed: %v", err)
	}

	success, err := WaitForSlot(recentSlot+1, nil)
	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}
	if !success {
		t.Errorf("Expected success to be true, but got false")
	}
}

func TestSolanaWaitForSlot_Timeout(t *testing.T) {
	client := InitRpcClient()
	recentSlot, err := client.GetSlot(context.Background(), rpc.CommitmentConfirmed)
	if err != nil {
		t.Fatalf("GetSlot failed: %v", err)
	}

	timeout := uint64(10)
	success, err := WaitForSlot(recentSlot+50, &timeout)
	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}
	if success {
		t.Errorf("Expected failure, but it passed")
	}
}
