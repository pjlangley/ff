package datastore

import (
	"database/sql"
	"errors"
	sqlite_crud "ff/sqlite_db"
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func SqliteRoutes(r *gin.RouterGroup) {
	coins := r.Group("/coins")

	coins.GET("", SqliteGetCoins)
	coins.GET("/:ticker", SqliteGetCoinByTicker)
	coins.GET("/after/:year", SqliteGetCoinsAfterYear)
	coins.PUT("/:ticker", SqliteAddCoin)
	coins.PATCH("/:ticker", SqliteUpdateCoin)
	coins.DELETE("/:ticker", SqliteDeleteCoin)
}

func SqliteGetCoins(c *gin.Context) {
	coins, err := sqlite_crud.GetAllItems()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to retrieve coins"})
		return
	}
	c.JSON(200, coins)
}

func SqliteGetCoinByTicker(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	coin, err := sqlite_crud.GetItemByTicker(ticker)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.Status(404)
			return
		}
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get coin by ticker %s", ticker)})
		return
	}
	c.JSON(200, coin)
}

func SqliteGetCoinsAfterYear(c *gin.Context) {
	year, err := strconv.Atoi(c.Param("year"))
	if err != nil {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Invalid year parameter %s", c.Param("year"))})
		return
	}
	coins, err := sqlite_crud.GetItemsAfterLaunchYear(year)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get coins after year %d", year)})
		return
	}
	c.JSON(200, coins)
}

func SqliteAddCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	var req CoinWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	coin := sqlite_crud.CryptoCoinWithoutId{Ticker: ticker, Name: req.Name, Launched: req.Launched}
	_, _, err := sqlite_crud.AddItem(coin)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to add coin with ticker %s", ticker)})
		return
	}
	c.Status(200)
}

func SqliteUpdateCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	var req CoinWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	coin := sqlite_crud.CryptoCoinWithoutId{Ticker: ticker, Name: req.Name, Launched: req.Launched}
	updatedCoin, err := sqlite_crud.UpdateItem(coin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.Status(404)
			return
		}
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to update coin with ticker %s", ticker)})
		return
	}
	c.JSON(200, updatedCoin)
}

func SqliteDeleteCoin(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	_, err := sqlite_crud.DeleteItem(ticker)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to delete coin with ticker %s", ticker)})
		return
	}
	c.Status(204)
}
