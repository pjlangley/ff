package solana_program_counter

import (
	"context"
	"encoding/binary"
	solana_program "ff/solana_program"
	"ff/solana_rpc"
	"fmt"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

func InitializeAccount(userKeypair solana.PrivateKey, programId solana.PublicKey) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	discriminator, err := solana_program.GetInstructionDiscriminator("initialize", "counter")
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}
	counterPda := solana_program.GetProgramDerivedAddress(userKeypair.PublicKey(), programId, solana_program.ProgramCounter)
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
	tx, err := createTransactionMessage(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func GetCount(userKeypair solana.PrivateKey, programId solana.PublicKey) (uint64, error) {
	client := solana_rpc.InitRpcClient()
	counterPda := solana_program.GetProgramDerivedAddress(userKeypair.PublicKey(), programId, solana_program.ProgramCounter)

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
	discriminator, err := solana_program.GetInstructionDiscriminator("increment", "counter")
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}
	counterPda := solana_program.GetProgramDerivedAddress(userKeypair.PublicKey(), programId, solana_program.ProgramCounter)
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
	tx, err := createTransactionMessage(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func createTransactionMessage(userKeypair solana.PrivateKey, instruction *solana.GenericInstruction) (*solana.Transaction, error) {
	client := solana_rpc.InitRpcClient()
	latestBlockhash, err := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest blockhash: %w", err)
	}

	tx, err := solana.NewTransaction(
		[]solana.Instruction{instruction},
		latestBlockhash.Value.Blockhash,
		solana.TransactionPayer(userKeypair.PublicKey()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	_, err = tx.Sign(
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

	return tx, nil
}
