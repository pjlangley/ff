package solana_program_username

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

type Username struct {
	Value string
}

type UsernameAccount struct {
	Authority             solana.PublicKey
	Username              Username
	ChangeCount           uint64
	UsernameRecentHistory []Username
}

type UsernameRecordAccount struct {
	Authority   solana.PublicKey
	Username    Username
	ChangeIndex uint64
}

func InitialiseUsername(userKeypair solana.PrivateKey, programId solana.PublicKey, username string) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	usernameAccountPda := solana_program.GetProgramDerivedAddress(userKeypair.PublicKey(), programId, "user_account")
	data, err := getDataForInstruction("initialize_username", username)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get data for instruction: %v", err)
	}

	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  userKeypair.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  usernameAccountPda,
				IsSigner:   false,
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

	tx, err := solana_transaction.CreateTxWithFeePayerAndLifetime(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func GetUsernameAccount(userPubkey solana.PublicKey, programId solana.PublicKey) (*UsernameAccount, error) {
	client := solana_rpc.InitRpcClient()
	usernameAccountPda := solana_program.GetProgramDerivedAddress(userPubkey, programId, "user_account")
	opts := &rpc.GetAccountInfoOpts{
		Encoding:   solana.EncodingBase64,
		Commitment: rpc.CommitmentConfirmed,
	}
	res, err := client.GetAccountInfoWithOpts(context.Background(), usernameAccountPda, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get username account info: %v", err)
	}
	if res.Value == nil {
		return nil, fmt.Errorf("username account not found")
	}

	data := res.Value.Data.GetBinary()
	cursor := data[8:] // Skip the 8-byte discriminator

	var authority solana.PublicKey
	copy(authority[:], cursor[:32])
	cursor = cursor[32:]

	usernameLen := binary.LittleEndian.Uint32(cursor[:4])
	cursor = cursor[4:]
	usernameValue := string(cursor[:usernameLen])
	cursor = cursor[usernameLen:]

	changeCount := binary.LittleEndian.Uint64(cursor[:8])
	cursor = cursor[8:]

	historyLen := binary.LittleEndian.Uint32(cursor[:4])
	cursor = cursor[4:]

	var usernameRecentHistory []Username
	for i := 0; i < int(historyLen); i++ {
		entryLen := binary.LittleEndian.Uint32(cursor[:4])
		cursor = cursor[4:]
		entryValue := string(cursor[:entryLen])
		cursor = cursor[entryLen:]

		usernameRecentHistory = append(usernameRecentHistory, Username{Value: entryValue})
	}

	if usernameRecentHistory == nil {
		usernameRecentHistory = []Username{}
	}

	return &UsernameAccount{
		Authority:             authority,
		Username:              Username{Value: usernameValue},
		ChangeCount:           changeCount,
		UsernameRecentHistory: usernameRecentHistory,
	}, nil
}

func UpdateUsername(userKeypair solana.PrivateKey, programId solana.PublicKey, username string) (solana.Signature, error) {
	client := solana_rpc.InitRpcClient()
	usernameAccount, err := GetUsernameAccount(userKeypair.PublicKey(), programId)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get username account: %v", err)
	}

	usernameAccountPda := solana_program.GetProgramDerivedAddress(userKeypair.PublicKey(), programId, "user_account")
	usernameRecordPda, _ := getUsernameRecordPda(userKeypair.PublicKey(), programId, usernameAccount.ChangeCount)

	data, err := getDataForInstruction("update_username", username)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to get data for instruction: %v", err)
	}

	instr := solana.NewInstruction(
		programId,
		solana.AccountMetaSlice{
			&solana.AccountMeta{
				PublicKey:  userKeypair.PublicKey(),
				IsSigner:   true,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  usernameAccountPda,
				IsSigner:   false,
				IsWritable: true,
			},
			&solana.AccountMeta{
				PublicKey:  usernameRecordPda,
				IsSigner:   false,
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

	tx, err := solana_transaction.CreateTxWithFeePayerAndLifetime(userKeypair, instr)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to create transaction: %v", err)
	}

	sig, err := client.SendTransactionWithOpts(context.Background(), tx, rpc.TransactionOpts{PreflightCommitment: rpc.CommitmentConfirmed})
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %v", err)
	}

	return sig, nil
}

func GetUsernameRecordAccount(userPubkey solana.PublicKey, programId solana.PublicKey, changeIndex uint64) (*UsernameRecordAccount, error) {
	client := solana_rpc.InitRpcClient()
	usernameRecordPda, _ := getUsernameRecordPda(userPubkey, programId, changeIndex)
	opts := &rpc.GetAccountInfoOpts{
		Encoding:   solana.EncodingBase64,
		Commitment: rpc.CommitmentConfirmed,
	}
	res, err := client.GetAccountInfoWithOpts(context.Background(), usernameRecordPda, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get username record account info: %v", err)
	}
	if res.Value == nil {
		return nil, fmt.Errorf("username record account not found")
	}

	data := res.Value.Data.GetBinary()
	cursor := data[8:] // Skip the 8-byte discriminator

	var authority solana.PublicKey
	copy(authority[:], cursor[:32])
	cursor = cursor[32:]

	usernameLen := binary.LittleEndian.Uint32(cursor[:4])
	cursor = cursor[4:]
	usernameValue := string(cursor[:usernameLen])
	cursor = cursor[usernameLen:]

	changeIdx := binary.LittleEndian.Uint64(cursor[:8])

	return &UsernameRecordAccount{
		Authority:   authority,
		Username:    Username{Value: usernameValue},
		ChangeIndex: changeIdx,
	}, nil
}

func getDataForInstruction(instructionName string, username string) ([]byte, error) {
	discriminator, err := solana_program.GetInstructionDiscriminator(instructionName, "username")
	if err != nil {
		return nil, fmt.Errorf("failed to get instruction discriminator: %v", err)
	}

	usernameBytes := []byte(username)
	usernameLen := uint32(len(usernameBytes))
	usernameLenBytes := make([]byte, 4)
	binary.LittleEndian.PutUint32(usernameLenBytes, usernameLen)

	// [8-byte discriminator][4-byte username length LE][username bytes (utf-8)]
	data := append(discriminator, usernameLenBytes...)
	data = append(data, usernameBytes...)

	return data, nil
}

func getUsernameRecordPda(userPubkey solana.PublicKey, programId solana.PublicKey, changeIndex uint64) (solana.PublicKey, error) {
	seed1 := []byte("username_record")
	seed2 := userPubkey.Bytes()
	seed3 := make([]byte, 8)
	binary.LittleEndian.PutUint64(seed3, changeIndex)

	pda, _, err := solana.FindProgramAddress(
		[][]byte{seed1, seed2, seed3},
		programId,
	)

	return pda, err
}
