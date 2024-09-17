package main

import (
	"ff/env_vars"
	"fmt"
)

func main() {
	fmt.Println("fragment 'env_vars' output:", env_vars.GetEnvVar("REPO_NAME"))
}
