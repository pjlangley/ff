package main

import (
	"ff/env_vars"
	redis_crud "ff/redis_db"
	sqlite_crud "ff/sqlite_db"
	"fmt"
)

func main() {
	// env vars
	fmt.Println("fragment 'env_vars' output:", env_vars.GetEnvVar("REPO_NAME"))

	// sqlite
	fmt.Println("fragment 'sqlite_db/GetItemByTicker' output:", sqlite_crud.GetItemByTicker("BTC"))
	fmt.Println("fragment 'sqlite_db/GetItemsAfterLaunchYear' output:", sqlite_crud.GetItemsAfterLaunchYear(2010))
	fmt.Println("fragment 'sqlite_db/GetAllItems' output:", sqlite_crud.GetAllItems())

	coin := sqlite_crud.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023}
	ok, newId := sqlite_crud.AddItem(coin)
	fmt.Printf("fragment 'sqlite_db/AddItem' output: ok=%s, newId=%d\n", ok, newId)

	// redis
	fmt.Println("fragment 'redis_db/ping' output:", redis_crud.RedisPing())
	fmt.Println("fragment 'redis_db/create' output:", redis_crud.RedisCreate("go", "bitcoin"))
	fmt.Println("fragment 'redis_db/read' output:", redis_crud.RedisRead("go"))
	fmt.Println("fragment 'redis_db/update' output:", redis_crud.RedisUpdate("go", "pepe"))
	fmt.Println("fragment 'redis_db/delete' output:", redis_crud.RedisDelete("go"))
}
