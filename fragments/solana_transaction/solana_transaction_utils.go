package solana_transaction

import (
	"context"
	solana_rpc "ff/solana_rpc"
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

func ConfirmRecentTransaction(signature solana.Signature) error {
	client := solana_rpc.InitRpcClient()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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
