package solana_transaction

import (
	"context"
	solana_rpc "ff/solana_rpc"
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

func ConfirmRecentTransaction(signature solana.Signature, timeoutSeconds ...float64) error {
	client := solana_rpc.InitRpcClient()
	timeout := 5 * time.Second
	if len(timeoutSeconds) > 0 && timeoutSeconds[0] > 0 {
		timeout = time.Duration(timeoutSeconds[0] * float64(time.Second))
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			statuses, err := client.GetSignatureStatuses(ctx, false, signature)
			if err != nil {
				return fmt.Errorf("failed to get signature statuses: %w", err)
			}

			status := statuses.Value[0]
			if status != nil {
				if status.Err != nil {
					return fmt.Errorf("transaction failed with error: %v", status.Err)
				}
				if status.ConfirmationStatus == rpc.ConfirmationStatusConfirmed {
					return nil
				}
			}

		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for confirmation of signature: %s", signature)
		}
	}
}

func CreateTxWithFeePayerAndLifetime(userKeypair solana.PrivateKey, instruction solana.Instruction) (*solana.Transaction, error) {
	client := solana_rpc.InitRpcClient()
	latestBlockhash, err := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest blockhash: %w", err)
	}

	tx, err := solana.NewTransaction(
		[]solana.Instruction{instruction},
		latestBlockhash.Value.Blockhash,
		solana.TransactionPayer(userKeypair.PublicKey()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
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
		return nil, fmt.Errorf("unable to sign transaction: %w", err)
	}

	return tx, nil
}
