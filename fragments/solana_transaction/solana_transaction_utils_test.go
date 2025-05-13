package solana_transaction

import (
	solana_airdrop "ff/solana_airdrop"
	"testing"

	"github.com/gagliardetto/solana-go"
)

func TestSolanaTransaction_ConfirmRecentTransaction_Success(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	signature := solana_airdrop.Airdrop(userKeypair.PublicKey(), 1_000_000_000)

	err := ConfirmRecentTransaction(signature)

	if err != nil {
		t.Errorf("Expected no error, but got %v", err)
	}
}
