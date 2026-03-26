use anchor_lang::AccountDeserialize;
use litesvm::LiteSVM;
use program_tests::{anchor_instr_data, assert_err_logs_contain, send_instr};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    system_program::ID as SYSTEM_PROGRAM_ID,
};

fn user_account_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"user_account", authority.as_ref()], &username::ID)
}

fn username_record_pda(authority: &Pubkey, change_count: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"username_record",
            authority.as_ref(),
            &change_count.to_le_bytes(),
        ],
        &username::ID,
    )
}

fn serialise_username_arg(value: &str) -> Vec<u8> {
    let bytes = value.as_bytes();
    let mut data = (bytes.len() as u32).to_le_bytes().to_vec();
    // [4-byte length][n-bytes utf-8 username]
    data.extend_from_slice(bytes);
    data
}

fn build_initialise_username_instr(
    authority: &Pubkey,
    user_account_pda: &Pubkey,
    value: &str,
) -> Instruction {
    Instruction::new_with_bytes(
        username::ID,
        &anchor_instr_data("initialize_username", &serialise_username_arg(value)),
        vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*user_account_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn build_update_username_instr(
    authority: &Pubkey,
    user_account_pda: &Pubkey,
    username_record_pda: &Pubkey,
    value: &str,
) -> Instruction {
    Instruction::new_with_bytes(
        username::ID,
        &anchor_instr_data("update_username", &serialise_username_arg(value)),
        vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*user_account_pda, false),
            AccountMeta::new(*username_record_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(username::ID, "../target/deploy/username.so")
        .expect("Failed to load username program");
    svm
}

fn fetch_user_account(svm: &LiteSVM, pda: &Pubkey) -> Option<username::UserAccount> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    username::UserAccount::try_deserialize(&mut data).ok()
}

fn fetch_username_record(svm: &LiteSVM, pda: &Pubkey) -> Option<username::UsernameRecord> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    username::UsernameRecord::try_deserialize(&mut data).ok()
}

#[test]
fn initialises_a_valid_username() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "-My_Username_123-");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user_account = fetch_user_account(&svm, &ua_pda).expect("user account should exist");
    assert_eq!(user_account.username.value, "-My_Username_123-");
    assert_eq!(user_account.change_count, 0);
    assert!(user_account.username_recent_history.is_empty());
}

#[test]
fn updates_a_valid_username() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());
    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user_account = fetch_user_account(&svm, &ua_pda).expect("user account should exist");
    assert_eq!(user_account.username.value, "my_username");

    let instr =
        build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, "my_new_username");
    send_instr(&mut svm, instr, &authority).expect("update should succeed");

    let user_account = fetch_user_account(&svm, &ua_pda).expect("user account should exist");
    assert_eq!(user_account.username.value, "my_new_username");
    assert_eq!(user_account.change_count, 1);
    assert_eq!(user_account.username_recent_history.len(), 1);
    assert_eq!(user_account.username_recent_history[0].value, "my_username");

    let record = fetch_username_record(&svm, &record_pda).expect("username record should exist");
    assert_eq!(record.old_username.value, "my_username");
    assert_eq!(record.change_index, 0);
}

#[test]
fn multiple_username_updates_tracked_in_recent_history() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "username0");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    for i in 0..=3 {
        let (record_pda, _) = username_record_pda(&authority.pubkey(), i);
        let new_name = format!("username{}", i + 1);
        let instr =
            build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, &new_name);
        send_instr(&mut svm, instr, &authority).expect("update should succeed");
    }

    let user_account = fetch_user_account(&svm, &ua_pda).expect("user account should exist");
    assert_eq!(user_account.username.value, "username4");
    assert_eq!(user_account.change_count, 4);
    assert_eq!(user_account.username_recent_history.len(), 3);
    assert_eq!(user_account.username_recent_history[0].value, "username1");
    assert_eq!(user_account.username_recent_history[1].value, "username2");
    assert_eq!(user_account.username_recent_history[2].value, "username3");
}

#[test]
fn multiple_username_updates_tracked_in_archived_record_history() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "username0");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    for i in 0..=3 {
        let (record_pda, _) = username_record_pda(&authority.pubkey(), i);
        let new_name = format!("username{}", i + 1);
        let instr =
            build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, &new_name);
        send_instr(&mut svm, instr, &authority).expect("update should succeed");
    }

    for i in 0..=3 {
        let (record_pda, _) = username_record_pda(&authority.pubkey(), i);
        let record =
            fetch_username_record(&svm, &record_pda).expect("username record should exist");
        assert_eq!(record.old_username.value, format!("username{i}"));
        assert_eq!(record.change_index, i);
    }
}

#[test]
fn init_fails_if_username_too_long() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let long_name = "a".repeat(33);
    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, &long_name);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "init with username too long should fail");
    assert_err_logs_contain(&result, "UsernameTooLong");
    assert_err_logs_contain(&result, "maximum length is 32 characters");
}

#[test]
fn init_fails_if_username_too_short() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "a");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "init with username too short should fail");
    assert_err_logs_contain(&result, "UsernameTooShort");
    assert_err_logs_contain(&result, "minimum length is 2 characters");
}

#[test]
fn init_fails_if_username_contains_invalid_characters() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "abc123@@@");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "init with invalid characters should fail");
    assert_err_logs_contain(&result, "UsernameInvalidCharacters");
    assert_err_logs_contain(
        &result,
        "only ascii alphanumeric, underscores, and hyphens are allowed",
    );
}

#[test]
fn update_fails_if_username_too_long() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);
    let long_name = "a".repeat(33);
    let instr = build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, &long_name);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "update with username too long should fail");
    assert_err_logs_contain(&result, "UsernameTooLong");
    assert_err_logs_contain(&result, "maximum length is 32 characters");
}

#[test]
fn update_fails_if_username_too_short() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);
    let instr = build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, "a");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(
        result.is_err(),
        "update with username too short should fail"
    );
    assert_err_logs_contain(&result, "UsernameTooShort");
    assert_err_logs_contain(&result, "minimum length is 2 characters");
}

#[test]
fn update_fails_if_username_contains_invalid_characters() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);
    let instr = build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, "abc123@@@");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(
        result.is_err(),
        "update with invalid characters should fail"
    );
    assert_err_logs_contain(&result, "UsernameInvalidCharacters");
    assert_err_logs_contain(
        &result,
        "only ascii alphanumeric, underscores, and hyphens are allowed",
    );
}

#[test]
fn fails_to_update_if_username_already_assigned() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);
    let instr =
        build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, "my_username");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "update with same username should fail");
    assert_err_logs_contain(&result, "UsernameAlreadyAssigned");
}

#[test]
fn fails_to_update_with_incorrect_username_record_account() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());

    let instr = build_initialise_username_instr(&authority.pubkey(), &ua_pda, "my_username");
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    // Use change_count=1 instead of 0 (incorrect record PDA)
    let (wrong_record_pda, _) = username_record_pda(&authority.pubkey(), 1);
    let instr = build_update_username_instr(
        &authority.pubkey(),
        &ua_pda,
        &wrong_record_pda,
        "my_new_username",
    );
    let result = send_instr(&mut svm, instr, &authority);
    assert!(
        result.is_err(),
        "update with incorrect record account should fail"
    );
    assert_err_logs_contain(&result, "ConstraintSeeds");
}

#[test]
fn fails_to_update_for_missing_user_account() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (ua_pda, _) = user_account_pda(&authority.pubkey());
    let (record_pda, _) = username_record_pda(&authority.pubkey(), 0);

    let instr = build_update_username_instr(&authority.pubkey(), &ua_pda, &record_pda, "abc123");
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "update without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}
