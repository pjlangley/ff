// Ignore these warnings - this isolated fragment is covered by unit tests
#![allow(dead_code)]
#![allow(unused_imports)]

use byteorder::{LittleEndian, ReadBytesExt};
use serde::Deserialize;
use solana_client::client_error::Result as ClientResult;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    message::{v0::Message, VersionedMessage},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    system_program,
    transaction::VersionedTransaction,
};
use std::fs;
use std::io::Cursor;
use std::path::Path;

use crate::solana_rpc::solana_rpc_utils::init_rpc_client;

#[derive(Deserialize, Debug)]
struct IdlInstruction {
    name: String,
    discriminator: Vec<u8>,
}

#[derive(Deserialize, Debug)]
struct Idl {
    instructions: Vec<IdlInstruction>,
}

pub fn initialize_account(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<Signature> {
    let discriminator = get_discriminator("initialize");
    let counter_pda = get_counter_pda(&user_keypair.pubkey(), &program_id);
    let client = init_rpc_client();
    let instruction = Instruction::new_with_bytes(
        program_id,
        &discriminator,
        vec![
            AccountMeta::new(user_keypair.pubkey(), true),
            AccountMeta::new(counter_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    );
    let message = create_transaction_message(&user_keypair.pubkey(), instruction);
    let tx = VersionedTransaction::try_new(VersionedMessage::V0(message), &[user_keypair])
        .unwrap_or_else(|err| panic!("Failed to sign transaction: {}", err));
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

fn get_count(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<u64> {
    let client = init_rpc_client();
    let counter_pda = get_counter_pda(&user_keypair.pubkey(), &program_id);
    let account = client.get_account(&counter_pda)?;

    // removes the discriminator from the account data
    let data = &account.data[8..];
    let mut cursor = Cursor::new(data);
    let count = cursor
        .read_u64::<LittleEndian>()
        .unwrap_or_else(|err| panic!("Failed to read u64 from account data: {}", err));

    Ok(count)
}

pub fn increment_counter(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<Signature> {
    let discriminator = get_discriminator("increment");
    let counter_pda = get_counter_pda(&user_keypair.pubkey(), &program_id);
    let client = init_rpc_client();
    let instruction = Instruction::new_with_bytes(
        program_id,
        &discriminator,
        vec![
            AccountMeta::new(counter_pda, false),
            AccountMeta::new(user_keypair.pubkey(), true),
        ],
    );
    let message = create_transaction_message(&user_keypair.pubkey(), instruction);
    let tx = VersionedTransaction::try_new(VersionedMessage::V0(message), &[user_keypair])
        .unwrap_or_else(|err| panic!("Failed to sign transaction: {}", err));
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

fn get_discriminator(instruction_name: &str) -> Vec<u8> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let idl_path = manifest_dir.join("fragments/blockchain/solana/target/idl/counter.json");
    let idl_content = fs::read_to_string(idl_path)
        .unwrap_or_else(|err| panic!("Unable to read IDL file: {}", err));
    let idl: Idl = serde_json::from_str(&idl_content)
        .unwrap_or_else(|err| panic!("Failed to parse IDL: {}", err));

    idl.instructions
        .into_iter()
        .find(|instr| instr.name == instruction_name)
        .map(|instr| instr.discriminator)
        .unwrap_or_else(|| panic!("Instruction '{}' not found in IDL", instruction_name))
}

fn get_counter_pda(user_pubkey: &Pubkey, program_id: &Pubkey) -> Pubkey {
    let seed1 = b"counter";
    let seed2 = user_pubkey.as_ref();
    let (pda, _) = Pubkey::find_program_address(&[seed1, seed2], program_id);
    pda
}

fn create_transaction_message(user_pubkey: &Pubkey, instruction: Instruction) -> Message {
    let client = init_rpc_client();
    let latest_blockhash = client
        .get_latest_blockhash()
        .unwrap_or_else(|err| panic!("Failed to get latest blockhash: {}", err));
    Message::try_compile(user_pubkey, &[instruction], &[], latest_blockhash)
        .unwrap_or_else(|err| panic!("Failed to compile message: {}", err))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_vars::env_vars_utils::get_env_var;
    use crate::solana_airdrop::solana_airdrop_utils::airdrop;
    use solana_sdk::signature::Keypair;
    use std::str::FromStr;

    fn get_program_id() -> Pubkey {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let env_path = manifest_dir.join("solana_program_keys/solana_program_keys.env");

        if env_path.exists() {
            dotenvy::from_path(&env_path).unwrap_or_else(|err| {
                panic!("Failed to load env vars from {:?}: {}", env_path, err)
            });
            println!("Environment variables loaded from {:?}", env_path);
        } else {
            println!("{:?} not found, skipping env loading", env_path);
        }

        let program_id = Pubkey::from_str(&get_env_var("counter_PROGRAM_ID"))
            .unwrap_or_else(|err| panic!("Failed to parse program id: {}", err));
        program_id
    }

    #[test]
    fn test_solana_initialize_account() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let program_id = get_program_id();

        let airdrop_signature = airdrop(user_keypair.pubkey(), 1_000_000_000).unwrap();
        client
            .poll_for_signature(&airdrop_signature)
            .unwrap_or_else(|err| panic!("Failed to poll for airdrop signature: {}", err));

        let _ = initialize_account(&user_keypair, &program_id);
        let count = get_count(&user_keypair, &program_id).unwrap();

        assert_eq!(count, 0)
    }

    #[test]
    fn test_solana_initialize_account_and_increment() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let program_id = get_program_id();

        let airdrop_signature = airdrop(user_keypair.pubkey(), 1_000_000_000).unwrap();
        client
            .poll_for_signature(&airdrop_signature)
            .unwrap_or_else(|err| panic!("Failed to poll for airdrop signature: {}", err));

        let _ = initialize_account(&user_keypair, &program_id);
        let count = get_count(&user_keypair, &program_id).unwrap();
        assert_eq!(count, 0);

        let _signature = increment_counter(&user_keypair, &program_id);
        let latest_count = get_count(&user_keypair, &program_id).unwrap();
        assert_eq!(latest_count, 1);
    }

    #[test]
    fn test_solana_increment_before_initialize() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let program_id = get_program_id();

        let airdrop_signature = airdrop(user_keypair.pubkey(), 1_000_000_000).unwrap();
        client
            .poll_for_signature(&airdrop_signature)
            .unwrap_or_else(|err| panic!("Failed to poll for airdrop signature: {}", err));

        let result = increment_counter(&user_keypair, &program_id);

        assert!(
            result.is_err(),
            "Incrementing counter before initialization should fail"
        );
        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotInitialized"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[test]
    fn test_solana_get_count_before_initialize() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let program_id = get_program_id();

        let airdrop_signature = airdrop(user_keypair.pubkey(), 1_000_000_000).unwrap();
        client
            .poll_for_signature(&airdrop_signature)
            .unwrap_or_else(|err| panic!("Failed to poll for airdrop signature: {}", err));

        let result = get_count(&user_keypair, &program_id);
        assert!(
            result.is_err(),
            "Getting count before initialization should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotFound"),
            "Unexpected error message: {}",
            error_string
        );
    }
}
