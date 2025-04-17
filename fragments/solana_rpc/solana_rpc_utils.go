package solana_rpc

import (
	"ff/env_vars"
	"strings"

	"github.com/gagliardetto/solana-go/rpc"
)

func getRpcUrl() string {
	localhost := "http://127.0.0.1:8899"

	if len(env_vars.GetEnvVar("CI")) == 0 {
		return localhost
	} else {
		return strings.Replace(localhost, "127.0.0.1", "solana-validator", 1)
	}
}

func InitRpcClient() *rpc.Client {
	url := getRpcUrl()
	client := rpc.New(url)

	return client
}
