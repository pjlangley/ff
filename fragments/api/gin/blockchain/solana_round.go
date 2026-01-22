package blockchain

import (
	"context"
	"ff/solana_airdrop"
	solana_program_round "ff/solana_program_round"
	"ff/solana_rpc"
	"ff/solana_transaction"
	"log"
	"strconv"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gin-gonic/gin"
)

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
var roundKeypairStorage = make(map[string]solana.PrivateKey)

func SolanaRoundRoutes(r *gin.RouterGroup) {
	round := r.Group("/round")
	round.POST("/initialise", InitialiseRound)
	round.GET("/:address", GetRound)
	round.PATCH("/:address/activate", ActivateRound)
	round.PATCH("/:address/complete", CompleteRound)
}

func InitialiseRound(c *gin.Context) {
	signer, err := solana.NewRandomPrivateKey()
	if err != nil {
		log.Printf("Error generating new random private key: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_airdrop.SendAndConfirmAirdrop(signer.PublicKey(), solana.LAMPORTS_PER_SOL)
	if err != nil {
		log.Printf("Error sending and confirming airdrop: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	address := signer.PublicKey().String()
	roundKeypairStorage[address] = signer

	client := solana_rpc.InitRpcClient()
	recentSlot, err := client.GetSlot(context.Background(), rpc.CommitmentConfirmed)
	if err != nil {
		log.Printf("Error getting recent slot: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	startSlot := recentSlot + 3

	sig, err := solana_program_round.InitialiseRound(signer, RoundProgramID, startSlot)
	if err != nil {
		log.Printf("Error initialising round: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	c.JSON(200, gin.H{
		"address":    address,
		"start_slot": strconv.FormatUint(startSlot, 10),
	})
}

func GetRound(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := roundKeypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	account, err := solana_program_round.GetRoundAccount(keypair.PublicKey(), RoundProgramID)
	if err != nil {
		log.Printf("Error getting round account: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	var activatedAt *string
	if account.ActivatedAt != nil {
		val := strconv.FormatUint(*account.ActivatedAt, 10)
		activatedAt = &val
	}

	var activatedBy *string
	if account.ActivatedBy != nil {
		val := account.ActivatedBy.String()
		activatedBy = &val
	}

	var completedAt *string
	if account.CompletedAt != nil {
		val := strconv.FormatUint(*account.CompletedAt, 10)
		completedAt = &val
	}

	c.JSON(200, gin.H{
		"start_slot":   strconv.FormatUint(account.StartSlot, 10),
		"authority":    account.Authority.String(),
		"activated_at": activatedAt,
		"activated_by": activatedBy,
		"completed_at": completedAt,
	})
}

func ActivateRound(c *gin.Context) {
	roundAddress := c.Param("address")
	_, exists := roundKeypairStorage[roundAddress]
	if !exists {
		c.Status(404)
		return
	}

	payer, err := solana.NewRandomPrivateKey()
	if err != nil {
		log.Printf("Error generating new random private key: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_airdrop.SendAndConfirmAirdrop(payer.PublicKey(), solana.LAMPORTS_PER_SOL)
	if err != nil {
		log.Printf("Error sending and confirming airdrop: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	authority, err := solana.PublicKeyFromBase58(roundAddress)
	if err != nil {
		log.Printf("Error parsing round address: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	sig, err := solana_program_round.ActivateRound(payer, RoundProgramID, authority)
	if err != nil {
		log.Printf("Error activating round: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	c.Status(200)
}

func CompleteRound(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := roundKeypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	sig, err := solana_program_round.CompleteRound(keypair, RoundProgramID)
	if err != nil {
		log.Printf("Error completing round: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	c.Status(200)
}
