package solana_airdrop

import (
	"ff/solana_rpc"

	"context"
	"fmt"
	"log"

	"github.com/dustin/go-humanize"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

func Airdrop(address solana.PublicKey, amount uint64) solana.Signature {
	client := solana_rpc.InitRpcClient()

	fmt.Printf("Airdropping %s lamports to %s\n", humanize.Comma(int64(amount)), address)

	sig, err := client.RequestAirdrop(context.Background(), address, amount, rpc.CommitmentConfirmed)

	if err != nil {
		log.Fatalf("Failed to request airdrop: %v", err)
	}

	return sig
}
