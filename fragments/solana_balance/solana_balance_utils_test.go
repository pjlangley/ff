package solana_balance

import (
	solana_key_pair_utils "ff/solana_key_pair"
	"testing"
)

func TestSolanaGetBalance(t *testing.T) {
	keypair, err := solana_key_pair_utils.CreateKeyPair()

	if err != nil {
		t.FailNow()
	}

	address := solana_key_pair_utils.GetAddress(keypair)
	balance, err := GetBalance(address)

	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}

	if balance != 0 {
		t.Errorf("Expected balance to be zero, but got %d", balance)
	}
}
