package blockchain

import (
	"ff/env_vars"
	"ff/solana_airdrop"
	solana_program_counter "ff/solana_program_counter"
	"ff/solana_transaction"
	"log"
	"path/filepath"
	"runtime"
	"strconv"

	"github.com/gagliardetto/solana-go"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var PROGRAM_ID = func() solana.PublicKey {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("cannot determine caller location")
	}

	baseDir := filepath.Dir(thisFile)
	envVars := filepath.Join(baseDir, "../../../../solana_program_keys/solana_program_keys.env")

	_ = godotenv.Load(envVars)

	programId := env_vars.GetEnvVar("counter_PROGRAM_ID")
	if programId == "" {
		log.Fatalf("Environment variable 'counter_PROGRAM_ID' not set")
	}

	return solana.MustPublicKeyFromBase58(programId)
}()

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
var keypairStorage = make(map[string]solana.PrivateKey)

func SolanaCounterRoutes(r *gin.RouterGroup) {
	counter := r.Group("/counter")
	counter.GET("/:address", GetCounter)
	counter.POST("/initialise", InitialiseCounter)
	counter.PATCH("/:address/increment", IncrementCounter)
}

func GetCounter(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := keypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	count, err := solana_program_counter.GetCount(keypair, PROGRAM_ID)
	if err != nil {
		log.Printf("Error getting count: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	c.JSON(200, gin.H{"count": strconv.FormatUint(count, 10)})
}

func InitialiseCounter(c *gin.Context) {
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
	keypairStorage[address] = signer

	sig, err := solana_program_counter.InitializeAccount(signer, PROGRAM_ID)
	if err != nil {
		log.Printf("Error initialising account: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	c.JSON(200, gin.H{"address": address})
}

func IncrementCounter(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := keypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	sig, err := solana_program_counter.IncrementCounter(keypair, PROGRAM_ID)
	if err != nil {
		log.Printf("Error incrementing counter: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	newCount, err := solana_program_counter.GetCount(keypair, PROGRAM_ID)
	if err != nil {
		log.Printf("Error getting count: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	c.JSON(200, gin.H{"new_count": strconv.FormatUint(newCount, 10)})
}
