package main

import (
	"ff/env_vars"
	redis_crud "ff/redis_db"
	sql_queries "ff/sql"
	"fmt"
)

func main() {
	// env vars
	fmt.Println("fragment 'env_vars' output:", env_vars.GetEnvVar("REPO_NAME"))

	// sql
	fmt.Println("fragment 'sql/GetItemByTicker' output:", sql_queries.GetItemByTicker("BTC"))
	fmt.Println("fragment 'sql/GetItemsAfterLaunchYear' output:", sql_queries.GetItemsAfterLaunchYear(2010))
	fmt.Println("fragment 'sql/GetAllItems' output:", sql_queries.GetAllItems())

	coin := sql_queries.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023}
	ok, newId := sql_queries.AddItem(coin)
	fmt.Printf("fragment 'sql/AddItem' output: ok=%s, newId=%d\n", ok, newId)

	// redis
	fmt.Println("fragment 'redis_db/ping' output:", redis_crud.RedisPing())
	fmt.Println("fragment 'redis_db/create' output:", redis_crud.RedisCreate("go", "bitcoin"))
	fmt.Println("fragment 'redis_db/read' output:", redis_crud.RedisRead("go"))
	fmt.Println("fragment 'redis_db/update' output:", redis_crud.RedisUpdate("go", "pepe"))
	fmt.Println("fragment 'redis_db/delete' output:", redis_crud.RedisDelete("go"))
}
