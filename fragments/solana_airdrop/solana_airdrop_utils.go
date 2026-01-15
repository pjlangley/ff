package solana_airdrop

import (
	"ff/solana_rpc"
	solana_transaction "ff/solana_transaction"

	"context"
	"fmt"

	"github.com/dustin/go-humanize"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

func SendAndConfirmAirdrop(address solana.PublicKey, amount uint64) error {
	client := solana_rpc.InitRpcClient()

	fmt.Printf("Airdropping %s lamports to %s\n", humanize.Comma(int64(amount)), address)

	sig, err := client.RequestAirdrop(context.Background(), address, amount, rpc.CommitmentConfirmed)
	if err != nil {
		return fmt.Errorf("failed to request airdrop: %w", err)
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		return fmt.Errorf("failed to confirm airdrop: %w", err)
	}

	fmt.Printf("Airdrop confirmed for %s with signature: %s\n", address, sig)
	return nil
}
