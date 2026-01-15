package solana_program_username

import (
	"ff/env_vars"
	"ff/solana_airdrop"
	"ff/solana_transaction"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/joho/godotenv"
)

var programId = func() solana.PublicKey {
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("failed to get current working directory: %v", err)
	}

	envPath := filepath.Join(cwd, "../../solana_program_keys/solana_program_keys.env")
	_ = godotenv.Load(envPath)

	programId := env_vars.GetEnvVar("username_PROGRAM_ID")
	if programId == "" {
		log.Fatalf("Environment variable 'username_PROGRAM_ID' not set")
	}

	return solana.MustPublicKeyFromBase58(programId)
}()

func TestSolanaUsernameInterface_InitialiseUsername(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}
	initialiseUsername(userKeypair, "my_username", t)

	usernameAccount, err := GetUsernameAccount(userKeypair.PublicKey(), programId)
	if err != nil {
		t.Errorf("GetUsernameAccount failed: %v", err)
	}

	expected := UsernameAccount{
		Authority:             userKeypair.PublicKey(),
		Username:              Username{Value: "my_username"},
		ChangeCount:           0,
		UsernameRecentHistory: []Username{},
	}

	if !reflect.DeepEqual(*usernameAccount, expected) {
		t.Errorf("Expected username account to be %+v, got %+v", expected, *usernameAccount)
	}
}

func TestSolanaUsernameInterface_InitialiseUsernameAndUpdate(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}
	initialiseUsername(userKeypair, "my_username", t)
	updateUsername(userKeypair, "my_new_username", t)

	usernameAccount, err := GetUsernameAccount(userKeypair.PublicKey(), programId)
	if err != nil {
		t.Errorf("GetUsernameAccount failed: %v", err)
	}

	usernameRecentHistory := make([]Username, 1)
	usernameRecentHistory[0] = Username{Value: "my_username"}

	expected := UsernameAccount{
		Authority:             userKeypair.PublicKey(),
		Username:              Username{Value: "my_new_username"},
		ChangeCount:           1,
		UsernameRecentHistory: usernameRecentHistory,
	}

	if !reflect.DeepEqual(*usernameAccount, expected) {
		t.Errorf("Expected username account to be %+v, got %+v", expected, *usernameAccount)
	}
}

func TestSolanaUsernameInterface_UpdateUsernameManyTimes(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}
	initialiseUsername(userKeypair, "username_0", t)

	for i := range 3 {
		updateUsername(userKeypair, fmt.Sprintf("username_%d", i+1), t)
	}

	usernameAccount, err := GetUsernameAccount(userKeypair.PublicKey(), programId)
	if err != nil {
		t.Errorf("GetUsernameAccount failed: %v", err)
	}

	usernameRecentHistory := make([]Username, 3)
	usernameRecentHistory[0] = Username{Value: "username_0"}
	usernameRecentHistory[1] = Username{Value: "username_1"}
	usernameRecentHistory[2] = Username{Value: "username_2"}

	expected := UsernameAccount{
		Authority:             userKeypair.PublicKey(),
		Username:              Username{Value: "username_3"},
		ChangeCount:           3,
		UsernameRecentHistory: usernameRecentHistory,
	}

	if !reflect.DeepEqual(*usernameAccount, expected) {
		t.Errorf("Expected username account to be %+v, got %+v", expected, *usernameAccount)
	}

	for i := range 3 {
		usernameRecordAccount, err := GetUsernameRecordAccount(userKeypair.PublicKey(), programId, uint64(i))
		if err != nil {
			t.Errorf("GetUsernameRecordAccount failed: %v", err)
		}
		expectedRecord := UsernameRecordAccount{
			Authority:   userKeypair.PublicKey(),
			Username:    Username{Value: fmt.Sprintf("username_%d", i)},
			ChangeIndex: uint64(i),
		}

		if !reflect.DeepEqual(*usernameRecordAccount, expectedRecord) {
			t.Errorf("Expected username record account %d to be %+v, got %+v", i, expectedRecord, *usernameRecordAccount)
		}
	}
}

func TestSolanaUsernameInterface_UpdateUsernameBeforeInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}

	_, err := UpdateUsername(userKeypair, programId, "my_new_username")
	if err == nil {
		t.Errorf("Expected error when updating username before initialisation, got nil")
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Expected not found error, got: %v", err.Error())
	}
}

func TestSolanaUsernameInterface_GetUsernameBeforeInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()

	_, err := GetUsernameAccount(userKeypair.PublicKey(), programId)
	if err == nil {
		t.Errorf("Expected error when getting username before initialisation, got nil")
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Expected not found error, got: %v", err.Error())
	}
}

func TestSolanaUsernameInterface_GetUsernameRecordBeforeInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()

	_, err := GetUsernameRecordAccount(userKeypair.PublicKey(), programId, 0)
	if err == nil {
		t.Errorf("Expected error when getting username record before initialisation, got nil")
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Expected not found error, got: %v", err.Error())
	}
}

func TestSolanaUsernameInterface_InvalidUsernameAtInit(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}

	_, err := InitialiseUsername(userKeypair, programId, "username!!!")
	if err == nil {
		t.Errorf("Expected error when initialising with invalid username, got nil")
	}
	if !strings.Contains(err.Error(), "UsernameInvalidCharacters") {
		t.Errorf("Expected UsernameInvalidCharacters error, got: %v", err.Error())
	}
}

func TestSolanaUsernameInterface_InvalidUsernameAtUpdate(t *testing.T) {
	userKeypair, _ := solana.NewRandomPrivateKey()
	if err := solana_airdrop.SendAndConfirmAirdrop(userKeypair.PublicKey(), solana.LAMPORTS_PER_SOL); err != nil {
		t.Errorf("SendAndConfirmAirdrop failed: %v", err)
	}
	initialiseUsername(userKeypair, "my_username", t)

	_, err := UpdateUsername(userKeypair, programId, "x")
	if err == nil {
		t.Errorf("Expected error when updating with invalid username, got nil")
	}
	if !strings.Contains(err.Error(), "UsernameTooShort") {
		t.Errorf("Expected UsernameTooShort error, got: %v", err.Error())
	}
}

func initialiseUsername(userKeypair solana.PrivateKey, username string, t *testing.T) {
	sig, err := InitialiseUsername(userKeypair, programId, username)
	if err != nil {
		t.Errorf("InitialiseUsername failed: %v", err)
	}
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("InitialiseUsername confirmation failed: %v", err)
	}
}

func updateUsername(userKeypair solana.PrivateKey, username string, t *testing.T) {
	sig, err := UpdateUsername(userKeypair, programId, username)
	if err != nil {
		t.Errorf("UpdateUsername failed: %v", err)
	}
	err = solana_transaction.ConfirmRecentTransaction(sig)
	if err != nil {
		t.Errorf("UpdateUsername confirmation failed: %v", err)
	}
}
