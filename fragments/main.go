package main

import (
	"ff/env_vars"
	sql_queries "ff/sql"
	"fmt"
)

func main() {
	fmt.Println("fragment 'env_vars' output:", env_vars.GetEnvVar("REPO_NAME"))
	fmt.Println("fragment 'sql/GetItemByTicker' output:", sql_queries.GetItemByTicker("BTC"))
	fmt.Println("fragment 'sql/GetItemsAfterLaunchYear' output:", sql_queries.GetItemsAfterLaunchYear(2010))
	fmt.Println("fragment 'sql/GetAllItems' output:", sql_queries.GetAllItems())

	coin := sql_queries.CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023}
	ok, newId := sql_queries.AddItem(coin)
	fmt.Printf("fragment 'sql/AddItem' output: ok=%s, newId=%d\n", ok, newId)
}
