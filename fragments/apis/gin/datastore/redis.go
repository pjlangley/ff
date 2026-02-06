package datastore

import (
	redis_crud "ff/redis_db"

	"github.com/gin-gonic/gin"
)

type FavouriteRequest struct {
	FavouriteCoin string `json:"favourite_coin" binding:"required"`
}

func RedisRoutes(r *gin.RouterGroup) {
	r.GET("/ping", RedisPing)
	favourites := r.Group("/favourites")

	favourites.GET("/:namespace", RedisGetFavourite)
	favourites.PUT("/:namespace", RedisCreateFavourite)
	favourites.PATCH("/:namespace", RedisUpdateFavourite)
	favourites.DELETE("/:namespace", RedisDeleteFavourite)
}

func RedisPing(c *gin.Context) {
	pong, err := redis_crud.RedisPing()
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	c.JSON(200, gin.H{"message": pong})
}

func RedisGetFavourite(c *gin.Context) {
	namespace := c.Param("namespace")
	item, err := redis_crud.RedisRead(namespace)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	if item["favourite_coin"] == "" {
		c.Status(404)
		return
	}
	c.JSON(200, item)
}

func RedisCreateFavourite(c *gin.Context) {
	namespace := c.Param("namespace")
	var req FavouriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	_, err := redis_crud.RedisCreate(namespace, req.FavouriteCoin)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	c.Status(200)
}

func RedisUpdateFavourite(c *gin.Context) {
	namespace := c.Param("namespace")
	var req FavouriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(422, gin.H{"error": "Invalid payload"})
		return
	}
	_, err := redis_crud.RedisUpdate(namespace, req.FavouriteCoin)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	c.Status(200)
}

func RedisDeleteFavourite(c *gin.Context) {
	namespace := c.Param("namespace")
	_, err := redis_crud.RedisDelete(namespace)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal Server Error"})
		return
	}
	c.Status(204)
}
