package main

import (
	"ff/env_vars"
	"fmt"

	api "ff/api/gin"
)

func main() {
	host := env_vars.GetEnvVar("GIN_HOST")
	if host == "" {
		host = "localhost"
	}
	addr := fmt.Sprintf("%s:3002", host)

	app := api.BuildApp()
	err := app.Run(addr)
	if err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		return
	}

	fmt.Printf("Server listening at %s\n", addr)
}
