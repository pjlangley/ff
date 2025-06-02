package solana_program

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/gagliardetto/solana-go"
)

type Idl struct {
	Instructions []struct {
		Name          string  `json:"name"`
		Discriminator []uint8 `json:"discriminator"`
	} `json:"instructions"`
}

type ProgramName string

const (
	ProgramCounter ProgramName = "counter"
)

var programIdMap = func() map[string]Idl {
	wd, err := os.Getwd()
	if err != nil {
		log.Fatalf("failed to get working directory: %v", err)
	}

	idls := make(map[string]string)
	idls["counter"] = filepath.Join(wd, "../blockchain/solana/target/idl/counter.json")

	programIdMap := make(map[string]Idl)

	for name, path := range idls {
		data, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("Error reading IDL file for %s: %v", name, err)
		}

		var idl Idl
		if err := json.Unmarshal(data, &idl); err != nil {
			log.Fatalf("Error unmarshalling IDL data for %s: %v", name, err)
		}

		programIdMap[name] = idl
	}

	return programIdMap
}()

func GetInstructionDiscriminator(instructionName string, programName string) ([]uint8, error) {
	idl := programIdMap[programName]

	for _, instruction := range idl.Instructions {
		if instruction.Name == instructionName {
			return instruction.Discriminator, nil
		}
	}

	return nil, fmt.Errorf("Instruction %s not found in program %s IDL", instructionName, programName)
}

func GetProgramDerivedAddress(userPubkey solana.PublicKey, programPubkey solana.PublicKey, programName ProgramName) solana.PublicKey {
	seed1 := []byte(programName)
	seed2 := userPubkey.Bytes()
	pda, _, err := solana.FindProgramAddress(
		[][]byte{seed1, seed2},
		programPubkey,
	)
	if err != nil {
		log.Fatalf("Error finding program address for %s: %v", programName, err)
	}
	return pda
}
