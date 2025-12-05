package datastore

import "github.com/gin-gonic/gin"

func PostgresRoutes(r *gin.RouterGroup) {
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "PONG",
		})
	})
}
