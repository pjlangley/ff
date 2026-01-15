package solana_program_round

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"ff/env_vars"
	"ff/solana_airdrop"
	"ff/solana_rpc"
	"ff/solana_transaction"

	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/joho/godotenv"
)

var programId = func() solana.PublicKey {
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("failed to get current working directory: %v", err)
	}

	envPath := filepath.Join(cwd, "../../solana_program_keys/solana_program_keys.env")
	_ = godotenv.Load(envPath)

	programId := env_vars.GetEnvVar("round_PROGRAM_ID")
	if programId == "" {
		log.Fatalf("Environment variable 'round_PROGRAM_ID' not set")
	}

	return solana.MustPublicKeyFromBase58(programId)
}()

func TestSolanaRoundInterface_Init_Activate_Complete(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}
	recentSlot := getSlot(t)
	startSlot := recentSlot + 3
	initialiseRound(userKeypair, startSlot, t)
	roundAccount := getRoundAccount(userKeypair.PublicKey(), t)

	expectedAtInit := RoundAccount{
		StartSlot:   startSlot,
		ActivatedAt: nil,
		ActivatedBy: nil,
		Authority:   userKeypair.PublicKey(),
		CompletedAt: nil,
	}
	if !reflect.DeepEqual(*roundAccount, expectedAtInit) {
		t.Errorf("Expected round account to be %+v, got %+v", expectedAtInit, *roundAccount)
	}

	atSlot, err := solana_rpc.WaitForSlot(startSlot, nil)
	if err != nil || !atSlot {
		t.Errorf("WaitForSlot failed: %v", err)
	}

	activateRound(userKeypair, userKeypair.PublicKey(), t)
	roundAccount = getRoundAccount(userKeypair.PublicKey(), t)
	if roundAccount.ActivatedAt == nil {
		t.Errorf("Expected round account to have ActivatedAt set, got nil")
	}
	if *roundAccount.ActivatedBy != userKeypair.PublicKey() {
		t.Errorf("Expected round account ActivatedBy to be %s, got %v", userKeypair.PublicKey(), roundAccount.ActivatedBy)
	}

	completeRound(userKeypair, t)
	roundAccount = getRoundAccount(userKeypair.PublicKey(), t)
	if roundAccount.CompletedAt == nil {
		t.Errorf("Expected round account to have CompletedAt set, got nil")
	}
}

func TestSolanaRoundInterface_InvalidStartSlotAtInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Fatalf("SendAndConfirmAirdrop failed: %v", err)
	}
	_, err := InitialiseRound(userKeypair, programId, 0)
	if err == nil {
		t.Fatalf("Expected InitialiseRound to fail with past start slot, but it succeeded")
	}
	if !strings.Contains(err.Error(), "InvalidStartSlot") {
		t.Errorf("Expected InvalidStartSlot error, got: %v", err.Error())
	}
}

func TestSolanaRoundInterface_ActivateWithoutInitialise(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Fatalf("SendAndConfirmAirdrop failed: %v", err)
	}
	_, err := ActivateRound(userKeypair, programId, userKeypair.PublicKey())
	if err == nil {
		t.Fatalf("Expected ActivateRound to fail without initialise, but it succeeded")
	}
	if !strings.Contains(err.Error(), "AccountNotInitialized") {
		t.Errorf("Expected AccountNotInitialized error, got: %v", err.Error())
	}
}

func TestSolanaRoundInterface_InvalidSlotAtActivate(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Fatalf("SendAndConfirmAirdrop failed: %v", err)
	}
	recentSlot := getSlot(t)
	startSlot := recentSlot + 50
	initialiseRound(userKeypair, startSlot, t)
	_, err := ActivateRound(userKeypair, programId, userKeypair.PublicKey())
	if err == nil {
		t.Fatalf("Expected ActivateRound to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "InvalidRoundActivationSlot") {
		t.Errorf("Expected InvalidRoundActivationSlot error, got: %v", err.Error())
	}
}

func TestSolanaRoundInterface_CompleteRoundNoInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Fatalf("SendAndConfirmAirdrop failed: %v", err)
	}
	_, err := CompleteRound(userKeypair, programId)
	if err == nil {
		t.Fatalf("Expected CompleteRound to fail without initialise, but it succeeded")
	}
	if !strings.Contains(err.Error(), "AccountNotInitialized") {
		t.Errorf("Expected AccountNotInitialized error, got: %v", err.Error())
	}
}

func initialiseRound(authority solana.PrivateKey, startSlot uint64, t *testing.T) {
	sig, err := InitialiseRound(authority, programId, startSlot)
	if err != nil {
		t.Fatalf("InitialiseRound failed: %v", err)
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Fatalf("InitialiseRound confirmation failed: %v", err)
	}
}

func activateRound(payer solana.PrivateKey, authority solana.PublicKey, t *testing.T) {
	sig, err := ActivateRound(payer, programId, authority)
	if err != nil {
		t.Fatalf("ActivateRound failed: %v", err)
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Fatalf("ActivateRound confirmation failed: %v", err)
	}
}

func completeRound(authority solana.PrivateKey, t *testing.T) {
	sig, err := CompleteRound(authority, programId)
	if err != nil {
		t.Fatalf("CompleteRound failed: %v", err)
	}

	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Fatalf("CompleteRound confirmation failed: %v", err)
	}
}

func getSlot(t *testing.T) uint64 {
	client := solana_rpc.InitRpcClient()
	slot, err := client.GetSlot(context.Background(), rpc.CommitmentConfirmed)
	if err != nil {
		t.Fatalf("GetSlot failed: %v", err)
	}
	return slot
}

func getRoundAccount(authority solana.PublicKey, t *testing.T) *RoundAccount {
	account, err := GetRoundAccount(authority, programId)
	if err != nil {
		t.Fatalf("GetRoundAccount failed: %v", err)
	}
	return account
}
