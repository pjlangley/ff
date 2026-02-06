package blockchain

import (
	"ff/solana_balance"
	"log"
	"strconv"

	"github.com/gagliardetto/solana-go"
	"github.com/gin-gonic/gin"
)

func SolanaBalanceRoutes(r *gin.RouterGroup) {
	r.GET("/balance/:address", GetBalance)
}

func GetBalance(c *gin.Context) {
	address := c.Param("address")

	pubkey, err := solana.PublicKeyFromBase58(address)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid Solana address"})
		return
	}

	balance, err := solana_balance.GetBalance(pubkey)
	if err != nil {
		log.Printf("Error fetching balance: %v", err)
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}

	c.JSON(200, gin.H{
		"balance": strconv.FormatUint(balance, 10),
	})
}
