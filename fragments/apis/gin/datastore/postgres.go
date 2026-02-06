package datastore

import (
	"database/sql"
	"errors"
	postgres_crud "ff/postgres_db"
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type CoinWriteRequest struct {
	Name     string `json:"name" binding:"required"`
	Launched int    `json:"launched" binding:"required"`
}

func PostgresRoutes(r *gin.RouterGroup) {
	coins := r.Group("/coins")

	coins.GET("", PostgresGetCoins)
	coins.GET("/:ticker", PostgresGetCoinByTicker)
	coins.GET("/after/:year", PostgresGetCoinsAfterYear)
	coins.PUT("/:ticker", PostgresAddCoin)
	coins.PATCH("/:ticker", PostgresUpdateCoin)
	coins.DELETE("/:ticker", PostgresDeleteCoin)
}

func PostgresGetCoins(c *gin.Context) {
	coins, err := postgres_crud.GetAllItems()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get coins"})
		return
	}
	c.JSON(200, coins)
}

func PostgresGetCoinByTicker(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	coin, err := postgres_crud.GetItemByTicker(ticker)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get coin by ticker %s", ticker)})
		return
	}
	if coin == nil {
		c.Status(404)
		return
	}
	c.JSON(200, coin)
}

func PostgresGetCoinsAfterYear(c *gin.Context) {
	year, err := strconv.Atoi(c.Param("year"))
	if err != nil {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Invalid year parameter %s", c.Param("year"))})
		return
	}
	coins, err := postgres_crud.GetItemsAfterLaunchYear(year)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get coins after year %d", year)})
		return
	}
	c.JSON(200, coins)
}

func PostgresAddCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	var req CoinWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	coin := postgres_crud.CryptoCoinWithoutId{Ticker: ticker, Name: req.Name, Launched: req.Launched}
	_, err := postgres_crud.CreateItem(coin)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create coin"})
		return
	}
	c.Status(200)
}

func PostgresUpdateCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	var req CoinWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	coin := postgres_crud.CryptoCoinWithoutId{Ticker: ticker, Name: req.Name, Launched: req.Launched}
	updatedCoin, err := postgres_crud.UpdateItem(coin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.Status(404)
			return
		}
		c.JSON(500, gin.H{"error": "Failed to update coin"})
		return
	}
	c.JSON(200, updatedCoin)
}

func PostgresDeleteCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	_, err := postgres_crud.DeleteItem(ticker)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete coin"})
		return
	}
	c.Status(204)
}
