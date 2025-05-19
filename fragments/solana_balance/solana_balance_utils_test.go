package solana_balance

import (
	"testing"

	"github.com/gagliardetto/solana-go"
)

func TestSolanaGetBalance(t *testing.T) {
	keypair, err := solana.NewRandomPrivateKey()

	if err != nil {
		t.FailNow()
	}

	balance, err := GetBalance(keypair.PublicKey())

	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}

	if balance != 0 {
		t.Errorf("Expected balance to be zero, but got %d", balance)
	}
}
