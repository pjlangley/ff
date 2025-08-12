// Ignore these warnings - this isolated fragment is covered by unit tests
#![allow(dead_code)]

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
pub struct RoundAccount {
    pub start_slot: u64,

    #[br(map = |bytes: [u8; 32]| Pubkey::new_from_array(bytes))]
    pub authority: Pubkey,

    #[br(temp)]
    activated_at_present: u8,
    #[br(if(activated_at_present != 0))]
    pub activated_at: Option<u64>,

    #[br(temp)]
    activated_by_present: u8,
    #[br(if(activated_by_present != 0), map = |bytes: [u8; 32]| Some(Pubkey::new_from_array(bytes)))]
    pub activated_by: Option<Pubkey>,

    #[br(temp)]
    completed_at_present: u8,
    #[br(if(completed_at_present != 0))]
    pub completed_at: Option<u64>,
}

pub fn initialise_round(
    authority: &Keypair,
    program_id: Pubkey,
    start_slot: u64,
) -> ClientResult<Signature> {
    let pda = get_program_derived_address(&authority.pubkey(), &program_id, "round");
    let instr_discriminator = get_instruction_discriminator("initialise_round", "round");
    let start_slot_bytes = start_slot.to_le_bytes();
    let data = [instr_discriminator.as_slice(), start_slot_bytes.as_slice()].concat();

    let instr = Instruction::new_with_bytes(
        program_id,
        &data,
        vec![
            AccountMeta::new(pda, false),
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(authority, instr);
    let client = init_rpc_client();
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

pub fn get_round_account(authority: &Pubkey, program_id: Pubkey) -> ClientResult<RoundAccount> {
    let client = init_rpc_client();
    let pda = get_program_derived_address(authority, &program_id, "round");
    let account = client.get_account(&pda)?;

    let data = &account.data[8..]; // Skip the 8-byte discriminator
    let mut cursor = Cursor::new(data);
    let round_account = RoundAccount::read_le(&mut cursor)
        .unwrap_or_else(|err| panic!("Failed to read round account: {}", err));

    Ok(round_account)
}

pub fn activate_round(payer: &Keypair, program_id: Pubkey) -> ClientResult<Signature> {
    let pda = get_program_derived_address(&payer.pubkey(), &program_id, "round");
    let instr_discriminator = get_instruction_discriminator("activate_round", "round");
    let instr = Instruction::new_with_bytes(
        program_id,
        &instr_discriminator,
        vec![
            AccountMeta::new(pda, false),
            AccountMeta::new(payer.pubkey(), true),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(payer, instr);
    let client = init_rpc_client();
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

pub fn complete_round(authority: &Keypair, program_id: Pubkey) -> ClientResult<Signature> {
    let pda = get_program_derived_address(&authority.pubkey(), &program_id, "round");
    let instr_discriminator = get_instruction_discriminator("complete_round", "round");
    let instr = Instruction::new_with_bytes(
        program_id,
        &instr_discriminator,
        vec![
            AccountMeta::new(pda, false),
            AccountMeta::new(authority.pubkey(), true),
        ],
    );
    let tx = create_tx_with_fee_payer_and_lifetime(authority, instr);
    let client = init_rpc_client();
    let signature = client.send_and_confirm_transaction(&tx)?;

    Ok(signature)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_vars::env_vars_utils::get_env_var;
    use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;
    use crate::solana_rpc::solana_rpc_utils::wait_for_slot;
    use once_cell::sync::Lazy;
    use solana_sdk::native_token::LAMPORTS_PER_SOL;
    use solana_sdk::signature::Keypair;
    use std::path::Path;
    use std::str::FromStr;

    static PROGRAM_ID: Lazy<Pubkey> = Lazy::new(|| {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let env_path = manifest_dir.join("solana_program_keys/solana_program_keys.env");
        dotenvy::from_path(&env_path).ok();

        let program_id =
            Pubkey::from_str(&get_env_var("round_PROGRAM_ID")).expect("Failed to parse program id");
        program_id
    });

    #[test]
    fn test_solana_initialise_activate_complete_round() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL);
        let client = init_rpc_client();
        let recent_slot = client.get_slot().unwrap();
        let start_slot = recent_slot + 3;

        let _ = initialise_round(&keypair, *PROGRAM_ID, start_slot).unwrap();
        let account = get_round_account(&keypair.pubkey(), *PROGRAM_ID).unwrap();
        assert_eq!(account.authority, keypair.pubkey());
        assert_eq!(account.start_slot, start_slot);
        assert!(account.activated_at.is_none());
        assert!(account.activated_by.is_none());
        assert!(account.completed_at.is_none());

        let at_slot = wait_for_slot(start_slot, None).unwrap();

        if !at_slot {
            panic!("Failed to reach slot {} in time", start_slot);
        }

        let _ = activate_round(&keypair, *PROGRAM_ID).unwrap();
        let account = get_round_account(&keypair.pubkey(), *PROGRAM_ID).unwrap();
        assert!(account.activated_at.is_some());
        assert!(account.activated_by.is_some());

        let _ = complete_round(&keypair, *PROGRAM_ID).unwrap();
        let account = get_round_account(&keypair.pubkey(), *PROGRAM_ID).unwrap();
        assert!(account.completed_at.is_some());
    }

    #[test]
    fn test_solana_initialise_round_invalid_start_slot() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL);
        let start_slot = 0;

        let result = initialise_round(&keypair, *PROGRAM_ID, start_slot);
        assert!(
            result.is_err(),
            "Initialising round with invalid start slot should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("InvalidStartSlot"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[test]
    fn test_solana_activate_round_no_initialise() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL);

        let result = activate_round(&keypair, *PROGRAM_ID);
        assert!(
            result.is_err(),
            "Activating round without initialising should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotInitialized"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[test]
    fn test_solana_activate_round_invalid_start_slot() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL);
        let client = init_rpc_client();
        let recent_slot = client.get_slot().unwrap();
        let start_slot = recent_slot + 50;

        let _ = initialise_round(&keypair, *PROGRAM_ID, start_slot).unwrap();
        let result = activate_round(&keypair, *PROGRAM_ID);
        assert!(
            result.is_err(),
            "Activating round with invalid start slot should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("InvalidRoundActivationSlot"),
            "Unexpected error message: {}",
            error_string
        );
    }

    #[test]
    fn test_solana_complete_round_no_initialise() {
        let keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(keypair.pubkey(), LAMPORTS_PER_SOL);

        let result = complete_round(&keypair, *PROGRAM_ID);
        assert!(
            result.is_err(),
            "Completing round without initialising should fail"
        );

        let error_string = result.unwrap_err().to_string();
        assert!(
            error_string.contains("AccountNotInitialized"),
            "Unexpected error message: {}",
            error_string
        );
    }
}
