package solana_transaction

import (
	"context"
	solana_airdrop "ff/solana_airdrop"
	"ff/solana_rpc"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

func TestSolanaTransaction_ConfirmRecentTransaction_Success(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	sig := solana_airdrop.Airdrop(userKeypair.PublicKey(), 1_000_000_000)
	err := ConfirmRecentTransaction(sig)

	if err != nil {
		t.Errorf("Expected no error, but got %v", err)
	}
}

func TestSolanaTransaction_ConfirmRecentTransaction_Failure(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	client := solana_rpc.InitRpcClient()
	latestBlockhash, err := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		t.Errorf("Failed to get latest blockhash: %v", err)
	}

	instr := system.NewTransferInstruction(0, userKeypair.PublicKey(), userKeypair.PublicKey()).Build()
	tx, err := solana.NewTransaction(
		[]solana.Instruction{instr},
		latestBlockhash.Value.Blockhash,
		solana.TransactionPayer(userKeypair.PublicKey()),
	)
	if err != nil {
		t.Errorf("Failed to create transaction: %v", err)
	}

	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if userKeypair.PublicKey().Equals(key) {
				return &userKeypair
			}
			return nil
		},
	)
	if err != nil {
		t.Errorf("unable to sign transaction: %v", err)
	}

	err = ConfirmRecentTransaction(tx.Signatures[0], 0.1)
	if err == nil {
		t.Error("Expected confirm recent transaction to fail, but got nil")
	}
}
