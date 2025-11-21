use binrw::{binread, BinRead};
use std::io::Cursor;

use solana_client::client_error::Result as ClientResult;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    system_program,
};

use crate::{
    solana_program::solana_program_utils::{
        get_instruction_discriminator, get_program_derived_address,
    },
    solana_rpc::solana_rpc_utils::init_rpc_client,
    solana_transaction::solana_transaction_utils::create_tx_with_fee_payer_and_lifetime,
};

#[binread]
#[derive(Debug)]
pub struct Username {
    #[br(temp)]
    len: u32,
    #[br(count = len)]
    #[br(map = |bytes: Vec<u8>| String::from_utf8(bytes).unwrap())]
    pub value: String,
}

#[binread]
#[derive(Debug)]
pub struct UsernameRecordAccount {
    #[br(map = |bytes: [u8; 32]| Pubkey::new_from_array(bytes))]
    pub authority: Pubkey,
    pub old_username: Username,
    pub change_index: u64,
}

#[binread]
#[derive(Debug)]
pub struct UsernameAccount {
    #[br(map = |bytes: [u8; 32]| Pubkey::new_from_array(bytes))]
    pub authority: Pubkey,
    pub username: Username,
    pub change_count: u64,
    #[br(temp)]
    len: u32,
    #[br(count = len)]
    pub username_recent_history: Vec<Username>,
}

pub async fn initialise_username(
    user_keypair: &Keypair,
    program_id: Pubkey,
    username: &str,
) -> ClientResult<Signature> {
    let user_account_pda =
        get_program_derived_address(&user_keypair.pubkey(), &program_id, "user_account");
    let data = get_data_for_instruction("initialize_username", username);

    let instr = Instruction::new_with_bytes(
        program_id,
        &data,
        vec![
            AccountMeta::new(user_keypair.pubkey(), true),
            AccountMeta::new(user_account_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(user_keypair, instr).await;
    let client = init_rpc_client();
    let signature = client.send_and_confirm_transaction(&tx).await?;

    Ok(signature)
}

pub async fn get_username_account(
    user_pubkey: &Pubkey,
    program_id: Pubkey,
) -> ClientResult<UsernameAccount> {
    let client = init_rpc_client();
    let user_account_pda = get_program_derived_address(user_pubkey, &program_id, "user_account");
    let account = client.get_account(&user_account_pda).await?;

    let data = &account.data[8..]; // Skip the 8-byte discriminator
    let mut cursor = Cursor::new(data);
    let username_account = UsernameAccount::read_le(&mut cursor)
        .unwrap_or_else(|err| panic!("Failed to read username account: {}", err));

    Ok(username_account)
}

fn get_username_record_pda(user_pubkey: &Pubkey, program_id: Pubkey, change_index: u64) -> Pubkey {
    let seed1 = "username_record".as_bytes();
    let seed2 = user_pubkey.as_ref();
    let seed3 = &change_index.to_le_bytes();
    let (pda, _) = Pubkey::find_program_address(&[seed1, seed2, seed3], &program_id);
    pda
}

pub async fn update_username(
    user_keypair: &Keypair,
    program_id: Pubkey,
    username: &str,
) -> ClientResult<Signature> {
    let username_account = get_username_account(&user_keypair.pubkey(), program_id).await?;
    let change_count = username_account.change_count;
    let username_account_pda =
        get_program_derived_address(&user_keypair.pubkey(), &program_id, "user_account");
    let username_record_account_pda =
        get_username_record_pda(&user_keypair.pubkey(), program_id, change_count);
    let data = get_data_for_instruction("update_username", username);

    let instr = Instruction::new_with_bytes(
        program_id,
        &data,
        vec![
            AccountMeta::new(user_keypair.pubkey(), true),
            AccountMeta::new(username_account_pda, false),
            AccountMeta::new(username_record_account_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(user_keypair, instr).await;
    let client = init_rpc_client();
    let signature = client.send_and_confirm_transaction(&tx).await?;

    Ok(signature)
}

pub async fn get_username_record_account(
    user_pubkey: &Pubkey,
    program_id: Pubkey,
    change_index: u64,
) -> ClientResult<UsernameRecordAccount> {
    let client = init_rpc_client();
    let user_record_account_pda = get_username_record_pda(user_pubkey, program_id, change_index);
    let account = client.get_account(&user_record_account_pda).await?;

    let data = &account.data[8..]; // Skip the 8-byte discriminator
    let mut cursor = Cursor::new(data);
    let record = UsernameRecordAccount::read_le(&mut cursor)
        .unwrap_or_else(|err| panic!("Failed to read username record account: {}", err));

    Ok(record)
}

fn get_data_for_instruction(instruction_name: &str, username: &str) -> Vec<u8> {
    let instr_discriminator = get_instruction_discriminator(instruction_name, "username");
    let username_bytes = username.as_bytes();
    let username_len = username_bytes.len() as u32;
    let username_len_bytes = username_len.to_le_bytes();

    // [8-byte discriminator][4-byte length][n-bytes utf-8 username]
    [
        instr_discriminator.as_slice(),
        username_len_bytes.as_slice(),
        username_bytes,
    ]
    .concat()
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

        let program_id = Pubkey::from_str(&get_env_var("username_PROGRAM_ID"))
            .expect("Failed to parse program id");
        program_id
    });

    #[tokio::test]
    async fn test_solana_initialise_username() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let username = "my_username";
        let _ = initialise_username(&keypair, *PROGRAM_ID, username).await;

        let account = get_username_account(&keypair.pubkey(), *PROGRAM_ID)
            .await
            .unwrap();
        assert_eq!(account.authority, keypair.pubkey());
        assert_eq!(account.username.value, username);
        assert_eq!(account.change_count, 0);
        assert!(account.username_recent_history.is_empty());
    }

    #[tokio::test]
    async fn test_solana_initialise_and_update_username() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let username = "my_username";
        let _ = initialise_username(&keypair, *PROGRAM_ID, username).await;
        let _ = update_username(&keypair, *PROGRAM_ID, "new_username").await;

        let account = get_username_account(&keypair.pubkey(), *PROGRAM_ID)
            .await
            .unwrap();
        assert_eq!(account.authority, keypair.pubkey());
        assert_eq!(account.username.value, "new_username");
        assert_eq!(account.change_count, 1);
        assert_eq!(account.username_recent_history.len(), 1);
        assert_eq!(account.username_recent_history[0].value, username);
    }

    #[tokio::test]
    async fn test_solana_update_username_multiple_times() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let username = "username_0";
        let _ = initialise_username(&keypair, *PROGRAM_ID, username).await;

        for i in 1..=3 {
            let new_username = format!("username_{}", i);
            let _ = update_username(&keypair, *PROGRAM_ID, &new_username).await;
        }

        let username_account = get_username_account(&keypair.pubkey(), *PROGRAM_ID)
            .await
            .unwrap();
        assert_eq!(username_account.username.value, "username_3");
        assert_eq!(username_account.change_count, 3);
        assert_eq!(username_account.username_recent_history.len(), 3);
        assert_eq!(
            username_account.username_recent_history[2].value,
            "username_2"
        );
        assert_eq!(
            username_account.username_recent_history[1].value,
            "username_1"
        );
        assert_eq!(
            username_account.username_recent_history[0].value,
            "username_0"
        );

        for i in 0..=2 {
            let username_record_account =
                get_username_record_account(&keypair.pubkey(), *PROGRAM_ID, i)
                    .await
                    .unwrap();
            assert_eq!(username_record_account.authority, keypair.pubkey());
            assert_eq!(
                username_record_account.old_username.value,
                format!("username_{}", i)
            );
            assert_eq!(username_record_account.change_index, i);
        }
    }

    #[tokio::test]
    async fn test_solana_update_username_before_init() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let result = update_username(&keypair, *PROGRAM_ID, "new_username").await;

        assert!(
            result.is_err(),
            "updating username before initialising should fail"
        );
        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotFound"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[tokio::test]
    async fn test_solana_get_username_account_before_init() {
        let keypair = Keypair::new();
        let result = get_username_account(&keypair.pubkey(), *PROGRAM_ID).await;

        assert!(
            result.is_err(),
            "getting username account before initialising should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotFound"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[tokio::test]
    async fn test_solana_get_username_record_account_before_init() {
        let keypair = Keypair::new();
        let result = get_username_record_account(&keypair.pubkey(), *PROGRAM_ID, 0).await;

        assert!(
            result.is_err(),
            "getting username record account before initialising should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotFound"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[tokio::test]
    async fn test_solana_invalid_username_at_init() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let username = "my_username!!!";
        let result = initialise_username(&keypair, *PROGRAM_ID, username).await;

        assert!(
            result.is_err(),
            "invalid username at initialise should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("UsernameInvalidCharacters"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[tokio::test]
    async fn test_solana_invalid_username_at_update() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let username = "my_username";
        let _ = initialise_username(&keypair, *PROGRAM_ID, username).await;
        let result = update_username(&keypair, *PROGRAM_ID, "x").await;

        assert!(result.is_err(), "invalid username at update should fail");

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("UsernameTooShort"),
            "Unexpected error message: {}",
            error_string
        );
    }
}
