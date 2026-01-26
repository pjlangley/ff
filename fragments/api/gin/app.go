package api

import (
	"ff/api/gin/blockchain"
	"ff/api/gin/datastore"

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

	solanaGroup := app.Group("/solana")
	blockchain.SolanaBalanceRoutes(solanaGroup)
	blockchain.SolanaCounterRoutes(solanaGroup)
	blockchain.SolanaRoundRoutes(solanaGroup)
	blockchain.SolanaUsernameRoutes(solanaGroup)

	return app
}
