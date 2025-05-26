package solana_program

import (
	"reflect"
	"testing"
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
