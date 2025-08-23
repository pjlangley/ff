package solana_program_round

import (
	"context"
	"encoding/binary"
	solana_program "ff/solana_program"
	"ff/solana_rpc"
	"ff/solana_transaction"
	"fmt"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

type RoundAccount struct {
	StartSlot   uint64
	ActivatedAt *uint64
	ActivatedBy *solana.PublicKey
	Authority   solana.PublicKey
	CompletedAt *uint64
}

func InitialiseRound(authority solana.PrivateKey, programId solana.PublicKey, startSlot uint64) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	pda := solana_program.GetProgramDerivedAddress(authority.PublicKey(), programId, "round")
	instr_discriminator, err := solana_program.GetInstructionDiscriminator("initialise_round", "round")
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}

	startSlotBytes := make([]byte, 8)
	binary.LittleEndian.PutUint64(startSlotBytes, startSlot)
	data := append(instr_discriminator, startSlotBytes...)

	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  pda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  authority.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  solana.SystemProgramID,
				IsSigner:   false,
				IsWritable: false,
			},
		},
		data,
	)

	tx, err := solana_transaction.CreateTxWithFeePayerAndLifetime(authority, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func GetRoundAccount(authority solana.PublicKey, programId solana.PublicKey) (*RoundAccount, error) {
	client := solana_rpc.InitRpcClient()
	pda := solana_program.GetProgramDerivedAddress(authority, programId, "round")
	opts := &rpc.GetAccountInfoOpts{
		Encoding:   solana.EncodingBase64,
		Commitment: rpc.CommitmentConfirmed,
	}
	res, err := client.GetAccountInfoWithOpts(context.Background(), pda, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get round account info: %v", err)
	}
	if res.Value == nil {
		return nil, fmt.Errorf("round account not found")
	}

	data := res.Value.Data.GetBinary()
	cursor := data[8:] // Skip the 8-byte discriminator

	startSlot := binary.LittleEndian.Uint64(cursor[:8])
	cursor = cursor[8:]

	var roundOwner solana.PublicKey
	copy(roundOwner[:], cursor[:32])
	cursor = cursor[32:]

	activatedAtFlag := cursor[0]
	cursor = cursor[1:]
	var activatedAt *uint64
	if activatedAtFlag != 0 {
		val := binary.LittleEndian.Uint64(cursor[:8])
		activatedAt = &val
		cursor = cursor[8:]
	}

	activatedByFlag := cursor[0]
	cursor = cursor[1:]
	var activatedBy *solana.PublicKey
	if activatedByFlag != 0 {
		var val solana.PublicKey
		copy(val[:], cursor[:32])
		cursor = cursor[32:]
		activatedBy = &val
	}

	completedAtFlag := cursor[0]
	cursor = cursor[1:]
	var completedAt *uint64
	if completedAtFlag != 0 {
		val := binary.LittleEndian.Uint64(cursor[:8])
		completedAt = &val
	}

	return &RoundAccount{
		StartSlot:   startSlot,
		Authority:   roundOwner,
		ActivatedAt: activatedAt,
		ActivatedBy: activatedBy,
		CompletedAt: completedAt,
	}, nil
}

func ActivateRound(payer solana.PrivateKey, programId solana.PublicKey, authority solana.PublicKey) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	pda := solana_program.GetProgramDerivedAddress(authority, programId, "round")
	instr_discriminator, err := solana_program.GetInstructionDiscriminator("activate_round", "round")
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}

	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  pda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  payer.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
		},
		instr_discriminator,
	)

	tx, err := solana_transaction.CreateTxWithFeePayerAndLifetime(payer, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func CompleteRound(authority solana.PrivateKey, programId solana.PublicKey) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	pda := solana_program.GetProgramDerivedAddress(authority.PublicKey(), programId, "round")
	instr_discriminator, err := solana_program.GetInstructionDiscriminator("complete_round", "round")
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}

	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  pda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  authority.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
		},
		instr_discriminator,
	)

	tx, err := solana_transaction.CreateTxWithFeePayerAndLifetime(authority, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}
