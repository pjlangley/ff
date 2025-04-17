package solana_airdrop

import (
	"context"
	"ff/solana_balance"
	"ff/solana_key_pair"
	"ff/solana_rpc"
	"testing"
	"time"

	"github.com/gagliardetto/solana-go/rpc"
)

func TestSolanaAirdrop(t *testing.T) {
	keypair, keypairErr := solana_key_pair.CreateKeyPair()
	client := solana_rpc.InitRpcSubscriptionsClient()

	if keypairErr != nil {
		t.Fatalf("Failed to create keypair: %v", keypairErr)
	}

	balance, balanceErr := solana_balance.GetBalance(solana_key_pair.GetAddress(keypair))

	if balanceErr != nil {
		t.Fatalf("Failed to get initial balance: %v", balanceErr)
	}

	if balance != 0 {
		t.Fatalf("expected initial balance of zero but got: %d", balance)
	}

	sig := Airdrop(solana_key_pair.GetAddress(keypair), 1_000_000_000)

	sub, subErr := client.SignatureSubscribe(sig, rpc.CommitmentConfirmed)

	if subErr != nil {
		t.Fatalf("Expected no subscription error, but got %v", subErr)
	}
	defer sub.Unsubscribe()

	ctxWithTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	select {
	case res := <-sub.Response():
		if res.Value.Err != nil {
			t.Errorf("Expected no error in response, but got %s", res.Value.Err)
		}
	case <-ctxWithTimeout.Done():
		t.Error("Expected to receive a response, but timed out")
	}

	latestBalance, latestBalanceErr := solana_balance.GetBalance(solana_key_pair.GetAddress(keypair))

	if latestBalanceErr != nil {
		t.Errorf("Failed to get latest balance %v", latestBalanceErr)
	}

	if latestBalance != 1_000_000_000 {
		t.Errorf("Expected balance to be 1_000_000_000, but got %d", latestBalance)
	}
}
