package solana_key_pair

import (
	"github.com/gagliardetto/solana-go"
)

func CreateKeyPair() (solana.PrivateKey, error) {
	return solana.NewRandomPrivateKey()
}

func GetAddress(keypair solana.PrivateKey) solana.PublicKey {
	return keypair.PublicKey()
}
