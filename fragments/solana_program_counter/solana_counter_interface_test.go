package solana_program_counter

import (
	"ff/env_vars"
	"ff/solana_airdrop"
	"ff/solana_transaction"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/joho/godotenv"
)

func getProgramId() solana.PublicKey {
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("failed to get current working directory: %v", err)
	}

	envPath := filepath.Join(cwd, "../../solana_program_keys/solana_program_keys.env")
	if _, err := os.Stat(envPath); err == nil {
		if err := godotenv.Load(envPath); err != nil {
			log.Fatalf("Failed to load environment variables from %s: %v", envPath, err)
		}
		fmt.Printf("Environment variables loaded from %s\n", envPath)
	} else {
		fmt.Printf("%s not found, skipping env loading\n", envPath)
	}

	programId := env_vars.GetEnvVar("counter_PROGRAM_ID")
	if programId == "" {
		log.Fatalf("Environment variable 'counter_PROGRAM_ID' not set")
	}

	return solana.MustPublicKeyFromBase58(programId)
}

func TestSolanaCounterInterface_InitializeAccount(t *testing.T) {
	programId := getProgramId()
	userKeypair, _ := solana.NewRandomPrivateKey()
	solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), 1_000_000_000)

	sig, err := InitializeAccount(userKeypair, programId)
	if err != nil {
		t.Errorf("InitializeAccount failed: %v", err)
	}
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("InitializeAccount confirmation failed: %v", err)
	}

	count, err := GetCount(userKeypair, programId)
	if err != nil {
		t.Errorf("GetCount failed: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected count to be 0, got %d", count)
	}
}

func TestSolanaCounterInterface_InitializeAccountAndIncrement(t *testing.T) {
	programId := getProgramId()
	userKeypair, _ := solana.NewRandomPrivateKey()
	solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), 1_000_000_000)

	sig, err := InitializeAccount(userKeypair, programId)
	if err != nil {
		t.Errorf("InitializeAccount failed: %v", err)
	}
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("InitializeAccount confirmation failed: %v", err)
	}

	count, err := GetCount(userKeypair, programId)
	if err != nil {
		t.Errorf("GetCount failed: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected count to be 0, got %d", count)
	}

	sig, err = IncrementCounter(userKeypair, programId)
	if err != nil {
		t.Errorf("IncrementCounter failed: %v", err)
	}
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("IncrementCounter confirmation failed: %v", err)
	}

	latestCount, err := GetCount(userKeypair, programId)
	if err != nil {
		t.Errorf("GetCount failed: %v", err)
	}
	if latestCount != 1 {
		t.Errorf("Expected count to be 1, got %d", latestCount)
	}
}

func TestSolanaCounterInterface_IncrementBeforeInitialize(t *testing.T) {
	programId := getProgramId()
	userKeypair, _ := solana.NewRandomPrivateKey()
	solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), 1_000_000_000)

	_, err := IncrementCounter(userKeypair, programId)
	if err == nil {
		t.Errorf("Expected error when incrementing before initialization, got nil")
	}
	if !strings.Contains(err.Error(), "AccountNotInitialized") {
		t.Errorf("Expected AccountNotInitialized error, got: %v", err.Error())
	}
}

func TestSolanaCounterInterface_GetCountBeforeInitialize(t *testing.T) {
	programId := getProgramId()
	userKeypair, _ := solana.NewRandomPrivateKey()

	_, err := GetCount(userKeypair, programId)
	if err == nil {
		t.Errorf("Expected error when getting count before initialization, got nil")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Expected account not found error, got: %v", err.Error())
	}
}
