package blockchain

import (
	"ff/solana_airdrop"
	solana_program_username "ff/solana_program_username"
	"ff/solana_transaction"
	"log"
	"strconv"
	"strings"

	"github.com/gagliardetto/solana-go"
	"github.com/gin-gonic/gin"
)

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
var usernameKeypairStorage = make(map[string]solana.PrivateKey)

func SolanaUsernameRoutes(r *gin.RouterGroup) {
	username := r.Group("/username")
	username.POST("/initialise", InitialiseUsername)
	username.GET("/:address", GetUsername)
	username.PATCH("/:address", UpdateUsernameHandler)
	username.GET("/:address/record/:changeIndex", GetUsernameRecord)
}

type usernameRequestBody struct {
	Username string `json:"username"`
}

func InitialiseUsername(c *gin.Context) {
	var body usernameRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Error binding JSON: %v", err)
		c.JSON(400, gin.H{"error": "Bad Request"})
		return
	}

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
	usernameKeypairStorage[address] = signer

	sig, err := solana_program_username.InitialiseUsername(signer, UsernameProgramID, body.Username)
	if err != nil {
		log.Printf("Error initialising username: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		c.JSON(500, gin.H{"error": "Transaction sent but confirmation timed out"})
		return
	}

	c.JSON(200, gin.H{
		"address": address,
	})
}

func GetUsername(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := usernameKeypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	account, err := solana_program_username.GetUsernameAccount(keypair.PublicKey(), UsernameProgramID)
	if err != nil {
		log.Printf("Error getting username account: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	usernameHistory := make([]string, len(account.UsernameRecentHistory))
	for i, u := range account.UsernameRecentHistory {
		usernameHistory[i] = u.Value
	}

	c.JSON(200, gin.H{
		"username":                account.Username.Value,
		"change_count":            strconv.FormatUint(account.ChangeCount, 10),
		"username_recent_history": usernameHistory,
	})
}

func UpdateUsernameHandler(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := usernameKeypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	var body usernameRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Error binding JSON: %v", err)
		c.JSON(400, gin.H{"error": "Bad Request"})
		return
	}

	sig, err := solana_program_username.UpdateUsername(keypair, UsernameProgramID, body.Username)
	if err != nil {
		log.Printf("Error updating username: %v", err)
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

func GetUsernameRecord(c *gin.Context) {
	address := c.Param("address")
	keypair, exists := usernameKeypairStorage[address]
	if !exists {
		c.Status(404)
		return
	}

	changeIndexStr := c.Param("changeIndex")
	changeIndex, err := strconv.ParseUint(changeIndexStr, 10, 64)
	if err != nil {
		log.Printf("Error parsing changeIndex: %v", err)
		c.JSON(400, gin.H{"error": "Bad Request"})
		return
	}

	account, err := solana_program_username.GetUsernameRecordAccount(keypair.PublicKey(), UsernameProgramID, changeIndex)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.Status(404)
			return
		}
		log.Printf("Error getting username record account: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	c.JSON(200, gin.H{
		"old_username": account.Username.Value,
		"change_index": strconv.FormatUint(account.ChangeIndex, 10),
		"authority":    account.Authority.String(),
	})
}
