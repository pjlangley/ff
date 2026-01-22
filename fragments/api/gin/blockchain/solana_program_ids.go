package blockchain

import (
	"ff/env_vars"
	"log"
	"path/filepath"
	"runtime"

	"github.com/gagliardetto/solana-go"
	"github.com/joho/godotenv"
)

var (
	CounterProgramID solana.PublicKey
	RoundProgramID   solana.PublicKey
)

func init() {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("cannot determine caller location")
	}

	baseDir := filepath.Dir(thisFile)
	envVars := filepath.Join(baseDir, "../../../../solana_program_keys/solana_program_keys.env")
	_ = godotenv.Load(envVars)

	counterID := env_vars.GetEnvVar("counter_PROGRAM_ID")
	if counterID == "" {
		log.Fatalf("Environment variable 'counter_PROGRAM_ID' not set")
	}
	CounterProgramID = solana.MustPublicKeyFromBase58(counterID)

	roundID := env_vars.GetEnvVar("round_PROGRAM_ID")
	if roundID == "" {
		log.Fatalf("Environment variable 'round_PROGRAM_ID' not set")
	}
	RoundProgramID = solana.MustPublicKeyFromBase58(roundID)
}
