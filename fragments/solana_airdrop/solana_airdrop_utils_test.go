package solana_airdrop

import (
	"ff/solana_balance"
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

	err = SendAndConfirmAirdrop(keypair.PublicKey(), solana.LAMPORTS_PER_SOL)
	if err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}

	latestBalance, err := solana_balance.GetBalance(keypair.PublicKey())
	if err != nil {
		t.Errorf("Failed to get latest balance %v", err)
	}

	if latestBalance != solana.LAMPORTS_PER_SOL {
		t.Errorf("Expected balance to be %d, but got %d", solana.LAMPORTS_PER_SOL, latestBalance)
	}
}
