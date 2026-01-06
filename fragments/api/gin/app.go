package api

import (
	datastore "ff/api/gin/datastore"

	"github.com/gin-gonic/gin"
)

func BuildApp() *gin.Engine {
	app := gin.New()

	postgresGroup := app.Group("/postgres")
	datastore.PostgresRoutes(postgresGroup)

	sqliteGroup := app.Group("/sqlite")
	datastore.SqliteRoutes(sqliteGroup)

	redisGroup := app.Group("/redis")
	datastore.RedisRoutes(redisGroup)

	return app
}
