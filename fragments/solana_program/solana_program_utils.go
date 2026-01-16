package solana_program

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/gagliardetto/solana-go"
)

type Idl struct {
	Instructions []struct {
		Name          string  `json:"name"`
		Discriminator []uint8 `json:"discriminator"`
	} `json:"instructions"`
}

func mustFilePath(path string) string {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("cannot determine caller location")
	}
	baseDir := filepath.Dir(thisFile)
	return filepath.Join(baseDir, path)
}

var programIdlMap = func() map[string]Idl {
	idls := map[string]string{
		"counter":  mustFilePath("../blockchain/solana/target/idl/counter.json"),
		"round":    mustFilePath("../blockchain/solana/target/idl/round.json"),
		"username": mustFilePath("../blockchain/solana/target/idl/username.json"),
	}

	programIdlMap := make(map[string]Idl)

	for name, path := range idls {
		data, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("Error reading IDL file for %s: %v", name, err)
		}

		var idl Idl
		if err := json.Unmarshal(data, &idl); err != nil {
			log.Fatalf("Error unmarshalling IDL data for %s: %v", name, err)
		}

		programIdlMap[name] = idl
	}

	return programIdlMap
}()

func GetInstructionDiscriminator(instructionName string, programName string) ([]uint8, error) {
	idl := programIdlMap[programName]

	for _, instruction := range idl.Instructions {
		if instruction.Name == instructionName {
			return instruction.Discriminator, nil
		}
	}

	return nil, fmt.Errorf("Instruction %s not found in program %s IDL", instructionName, programName)
}

func GetProgramDerivedAddress(userPubkey solana.PublicKey, programPubkey solana.PublicKey, accountName string) solana.PublicKey {
	seed1 := []byte(accountName)
	seed2 := userPubkey.Bytes()
	pda, _, err := solana.FindProgramAddress(
		[][]byte{seed1, seed2},
		programPubkey,
	)
	if err != nil {
		log.Fatalf("Error finding program address for %s: %v", accountName, err)
	}
	return pda
}
