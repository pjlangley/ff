package solana_transaction

import (
	"context"

	"ff/solana_rpc"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

func TestSolanaTransaction_ConfirmRecentTransaction_Success(t *testing.T) {
	client := solana_rpc.InitRpcClient()
	userKeypair, _ := solana.NewRandomPrivateKey()

	// Note: can't use `SendAndConfirmAirdrop` due to circular dependency
	sig, err := client.RequestAirdrop(context.Background(), userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL, rpc.CommitmentConfirmed)
	if err != nil {
		t.Errorf("failed to request airdrop: %v", err)
	}

	err = ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("Expected confirm recent transaction to succeed, but got %v", err)
	}
}

func TestSolanaTransaction_ConfirmRecentTransaction_Failure(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	instr := system.NewTransferInstruction(0, userKeypair.PublicKey(), userKeypair.PublicKey()).Build()

	tx, err := CreateTxWithFeePayerAndLifetime(userKeypair, instr)
	if err != nil {
		t.Errorf("unable to create transaction: %v", err)
	}

	err = ConfirmRecentTransaction(tx.Signatures[0], 0.1)
	if err == nil {
		t.Error("Expected confirm recent transaction to fail, but got nil")
	}
}
