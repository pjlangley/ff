package solana_airdrop

import (
	"ff/solana_balance"
	solana_transaction "ff/solana_transaction"
	"testing"

	"github.com/gagliardetto/solana-go"
)

func TestSolanaAirdrop(t *testing.T) {
	keypair, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Errorf("Failed to create keypair: %v", err)
	}

	balance, err := solana_balance.GetBalance(keypair.PublicKey())
	if err != nil {
		t.Errorf("Failed to get initial balance: %v", err)
	}

	if balance != 0 {
		t.Errorf("expected initial balance of zero but got: %d", balance)
	}

	sig := Airdrop(keypair.PublicKey(), 1_000_000_000)
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("expected airdrop signature confirmation, but got %v", err)
	}

	latestBalance, err := solana_balance.GetBalance(keypair.PublicKey())
	if err != nil {
		t.Errorf("Failed to get latest balance %v", err)
	}

	if latestBalance != 1_000_000_000 {
		t.Errorf("Expected balance to be 1_000_000_000, but got %d", latestBalance)
	}
}
