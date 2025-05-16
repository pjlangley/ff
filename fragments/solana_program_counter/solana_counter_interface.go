package solana_program_counter

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"ff/solana_rpc"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

type Idl struct {
	Instructions []struct {
		Name          string  `json:"name"`
		Discriminator []uint8 `json:"discriminator"`
	} `json:"instructions"`
}

func InitializeAccount(userKeypair solana.PrivateKey, programId solana.PublicKey) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	discriminator := getDiscriminator("initialize")
	counterPda := getCounterPda(userKeypair.PublicKey(), programId)
	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  userKeypair.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  counterPda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  solana.SystemProgramID,
				IsSigner:   false,
				IsWritable: false,
			},
		},
		discriminator,
	)
	txn, err := createTransactionMessage(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), txn, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func GetCount(userKeypair solana.PrivateKey, programId solana.PublicKey) (uint64, error) {
	client := solana_rpc.InitRpcClient()
	counterPda := getCounterPda(userKeypair.PublicKey(), programId)

	offset := uint64(8)
	length := uint64(8)
	opts := &rpc.GetAccountInfoOpts{
		Encoding:   solana.EncodingBase64,
		Commitment: rpc.CommitmentConfirmed,
		// offset removes the discriminator from the account data
		DataSlice: &rpc.DataSlice{Offset: &offset, Length: &length},
	}
	res, err := client.GetAccountInfoWithOpts(context.Background(), counterPda, opts)
	if err != nil {
		return 0, fmt.Errorf("failed to get account info: %w", err)
	}
	if res.Value == nil {
		return 0, fmt.Errorf("account not found")
	}

	data := res.Value.Data.GetBinary()
	if len(data) < 8 {
		return 0, fmt.Errorf("invalid data length: %d", len(data))
	}

	count := uint64(binary.LittleEndian.Uint64((data)))
	return count, nil
}

func IncrementCounter(userKeypair solana.PrivateKey, programId solana.PublicKey) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	discriminator := getDiscriminator("increment")
	counterPda := getCounterPda(userKeypair.PublicKey(), programId)
	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  counterPda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  userKeypair.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
		},
		discriminator,
	)
	txn, err := createTransactionMessage(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), txn, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func getDiscriminator(instructionName string) []uint8 {
	wd, err := os.Getwd()
	if err != nil {
		log.Fatalf("Error getting executable path: %v", err)
	}

	idlPath := filepath.Join(wd, "../blockchain/solana/target/idl/counter.json")

	data, err := os.ReadFile(idlPath)
	if err != nil {
		log.Fatalf("Error reading IDL file: %v", err)
	}

	var idl Idl
	if err := json.Unmarshal(data, &idl); err != nil {
		log.Fatalf("Error unmarshalling IDL data: %v", err)
	}

	for _, instruction := range idl.Instructions {
		if instruction.Name == instructionName {
			return instruction.Discriminator
		}
	}

	log.Fatalf("Instruction name '%s' not found in IDL", instructionName)
	return nil
}

func getCounterPda(userPubkey solana.PublicKey, programId solana.PublicKey) solana.PublicKey {
	seed1 := []byte("counter")
	seed2 := userPubkey.Bytes()
	pda, _, err := solana.FindProgramAddress(
		[][]byte{seed1, seed2},
		programId,
	)
	if err != nil {
		log.Fatalf("Error finding program address: %v", err)
	}
	return pda
}

func createTransactionMessage(userKeypair solana.PrivateKey, instruction *solana.GenericInstruction) (*solana.Transaction, error) {
	client := solana_rpc.InitRpcClient()
	latestBlockhash, err := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest blockhash: %w", err)
	}

	txn, err := solana.NewTransaction(
		[]solana.Instruction{instruction},
		latestBlockhash.Value.Blockhash,
		solana.TransactionPayer(userKeypair.PublicKey()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	_, err = txn.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if userKeypair.PublicKey().Equals(key) {
				return &userKeypair
			}
			return nil
		},
	)
	if err != nil {
		return nil, fmt.Errorf("unable to sign transaction: %w", err)
	}

	return txn, nil
}
