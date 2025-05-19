package solana_key_pair

import (
	"testing"
)

func TestCreateKeyPairAndGetAddress(t *testing.T) {
	keypair, err := CreateKeyPair()

	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}

	address := GetAddress(keypair)

	if address != keypair.PublicKey() {
		t.Errorf("Expected address to match keypair pubkey, but got %s / %s", address, keypair.PublicKey())
	}
}
