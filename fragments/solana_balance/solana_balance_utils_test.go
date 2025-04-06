package solana_balance_utils

import (
	solana_key_pair_utils "ff/solana_key_pair"
	"testing"
)

func TestSolanaGetBalance(t *testing.T) {
	keypair, keypairErr := solana_key_pair_utils.CreateKeyPair()

	if keypairErr != nil {
		t.FailNow()
	}

	address := solana_key_pair_utils.GetAddress(keypair)
	balance, balanceErr := GetBalance(address)

	if balanceErr != nil {
		t.Errorf("Expected no error, but got %s", balanceErr)
	}

	if balance != 0 {
		t.Errorf("Expected balance to be zero, but got %d", balance)
	}
}
