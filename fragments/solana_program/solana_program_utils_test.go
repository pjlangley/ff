package solana_program

import (
	"reflect"
	"testing"

	"github.com/gagliardetto/solana-go"
)

func TestSolanaProgram_GetInstructionDiscriminator(t *testing.T) {
	discriminator, _ := GetInstructionDiscriminator("initialize", "counter")
	expected := []uint8{175, 175, 109, 31, 13, 152, 155, 237}

	if !reflect.DeepEqual(discriminator, expected) {
		t.Errorf("Expected discriminator %v, got %v", expected, discriminator)
	}
}

func TestSolanaProgram_GetInstructionDiscriminator_InvalidInstr(t *testing.T) {
	_, err := GetInstructionDiscriminator("invalid_instruction", "counter")
	if err == nil {
		t.Error("Expected error for invalid instruction, got nil")
	}
}

func TestSolanaProgram_GetProgramDerivedAddress(t *testing.T) {
	userPubkey, _ := solana.PublicKeyFromBase58("71jvqeEzwVnz6dpo2gZAKbCZkq6q6bpt9nkHZvBiia4Z")
	programPubkey, _ := solana.PublicKeyFromBase58("23Ww1C2uzCiH9zjmfhG6QmkopkeanZM87mjDHu8MMwXY")
	pda := GetProgramDerivedAddress(userPubkey, programPubkey, ProgramCounter)
	expected := "9yFnCu3Nyr4aa7kdd4ckAyPKABQyTPLX2Xm4Aj2MXsLc"

	if pda.String() != expected {
		t.Errorf("Expected PDA %s, got %s", expected, pda)
	}
}
