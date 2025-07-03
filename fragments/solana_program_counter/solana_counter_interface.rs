// Ignore these warnings - this isolated fragment is covered by unit tests
#![allow(dead_code)]

use binrw::{binread, BinRead};
use solana_client::client_error::Result as ClientResult;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    system_program,
};
use std::io::Cursor;

use crate::{
    solana_program::solana_program_utils::{
        get_instruction_discriminator, get_program_derived_address,
    },
    solana_rpc::solana_rpc_utils::init_rpc_client,
    solana_transaction::solana_transaction_utils::create_tx_with_fee_payer_and_lifetime,
};

#[binread]
#[derive(Debug)]
pub struct Counter {
    pub count: u64,
}

pub fn initialize_account(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<Signature> {
    let discriminator = get_instruction_discriminator("initialize", "counter");
    let counter_pda = get_program_derived_address(&user_keypair.pubkey(), &program_id, "counter");
    let client = init_rpc_client();
    let instr = Instruction::new_with_bytes(
        program_id,
        &discriminator,
        vec![
            AccountMeta::new(user_keypair.pubkey(), true),
            AccountMeta::new(counter_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(user_keypair, instr);
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

fn get_count(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<Counter> {
    let client = init_rpc_client();
    let counter_pda = get_program_derived_address(&user_keypair.pubkey(), &program_id, "counter");
    let account = client.get_account(&counter_pda)?;

    let data = &account.data[8..]; // rm discriminator from account data
    let mut cursor = Cursor::new(data);
    let counter = Counter::read_le(&mut cursor)
        .unwrap_or_else(|err| panic!("Failed to read count from account data: {}", err));

    Ok(counter)
}

pub fn increment_counter(user_keypair: &Keypair, &program_id: &Pubkey) -> ClientResult<Signature> {
    let discriminator = get_instruction_discriminator("increment", "counter");
    let counter_pda = get_program_derived_address(&user_keypair.pubkey(), &program_id, "counter");
    let client = init_rpc_client();
    let instr = Instruction::new_with_bytes(
        program_id,
        &discriminator,
        vec![
            AccountMeta::new(counter_pda, false),
            AccountMeta::new(user_keypair.pubkey(), true),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(user_keypair, instr);
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_vars::env_vars_utils::get_env_var;
    use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;
    use once_cell::sync::Lazy;
    use solana_sdk::native_token::LAMPORTS_PER_SOL;
    use solana_sdk::signature::Keypair;
    use std::path::Path;
    use std::str::FromStr;

    static PROGRAM_ID: Lazy<Pubkey> = Lazy::new(|| {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let env_path = manifest_dir.join("solana_program_keys/solana_program_keys.env");
        dotenvy::from_path(&env_path).ok();

        let program_id = Pubkey::from_str(&get_env_var("counter_PROGRAM_ID"))
            .expect("Failed to parse program id");
        program_id
    });

    #[test]
    fn test_solana_initialize_account() {
        let user_keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL);

        let _ = initialize_account(&user_keypair, &PROGRAM_ID);
        let counter = get_count(&user_keypair, &PROGRAM_ID).unwrap();

        assert_eq!(counter.count, 0)
    }

    #[test]
    fn test_solana_initialize_account_and_increment() {
        let user_keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL);

        let _ = initialize_account(&user_keypair, &PROGRAM_ID);
        let counter = get_count(&user_keypair, &PROGRAM_ID).unwrap();
        assert_eq!(counter.count, 0);

        let _signature = increment_counter(&user_keypair, &PROGRAM_ID);
        let latest_counter = get_count(&user_keypair, &PROGRAM_ID).unwrap();
        assert_eq!(latest_counter.count, 1);
    }

    #[test]
    fn test_solana_increment_before_initialize() {
        let user_keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL);

        let result = increment_counter(&user_keypair, &PROGRAM_ID);

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
        let user_keypair = Keypair::new();

        let result = get_count(&user_keypair, &PROGRAM_ID);
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
