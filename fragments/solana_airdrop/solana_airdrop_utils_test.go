package solana_airdrop

import (
	"ff/solana_balance"
	"ff/solana_key_pair"
	solana_transaction "ff/solana_transaction"
	"testing"
)

func TestSolanaAirdrop(t *testing.T) {
	keypair, err := solana_key_pair.CreateKeyPair()
	if err != nil {
		t.Errorf("Failed to create keypair: %v", err)
	}

	balance, err := solana_balance.GetBalance(solana_key_pair.GetAddress(keypair))
	if err != nil {
		t.Errorf("Failed to get initial balance: %v", err)
	}

	if balance != 0 {
		t.Errorf("expected initial balance of zero but got: %d", balance)
	}

	sig := Airdrop(solana_key_pair.GetAddress(keypair), 1_000_000_000)
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("expected airdrop signature confirmation, but got %v", err)
	}

	latestBalance, err := solana_balance.GetBalance(solana_key_pair.GetAddress(keypair))
	if err != nil {
		t.Errorf("Failed to get latest balance %v", err)
	}

	if latestBalance != 1_000_000_000 {
		t.Errorf("Expected balance to be 1_000_000_000, but got %d", latestBalance)
	}
}
