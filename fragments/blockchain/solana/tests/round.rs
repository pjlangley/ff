use anchor_lang::AccountDeserialize;
use litesvm::LiteSVM;
use program_tests::{anchor_discriminator, anchor_instr_data, assert_err_logs_contain, send_instr};
use solana_sdk::{
    clock::Clock,
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    system_program::ID as SYSTEM_PROGRAM_ID,
};

fn round_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"round", authority.as_ref()], &round::ID)
}

fn build_initialise_round_instr(
    authority: &Pubkey,
    round_pda: &Pubkey,
    start_slot: u64,
) -> Instruction {
    Instruction::new_with_bytes(
        round::ID,
        &anchor_instr_data("initialise_round", &start_slot.to_le_bytes()),
        vec![
            AccountMeta::new(*round_pda, false),
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn build_activate_round_instr(user: &Pubkey, round_pda: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        round::ID,
        &anchor_discriminator("activate_round"),
        vec![
            AccountMeta::new(*round_pda, false),
            AccountMeta::new_readonly(*user, true),
        ],
    )
}

fn build_complete_round_instr(authority: &Pubkey, round_pda: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        round::ID,
        &anchor_discriminator("complete_round"),
        vec![
            AccountMeta::new(*round_pda, false),
            AccountMeta::new_readonly(*authority, true),
        ],
    )
}

fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(round::ID, "../target/deploy/round.so")
        .expect("Failed to load round program");
    svm
}

fn fetch_round(svm: &LiteSVM, pda: &Pubkey) -> Option<round::Round> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    round::Round::try_deserialize(&mut data).ok()
}

fn current_slot(svm: &LiteSVM) -> u64 {
    svm.get_sysvar::<Clock>().slot
}

// Round initialisation

#[test]
fn initialises_a_round() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let round = fetch_round(&svm, &pda).expect("round account should exist");
    assert_eq!(round.authority, authority.pubkey());
    assert_eq!(round.start_slot, start_slot);
}

#[test]
fn fails_to_initialise_a_round_if_already_initialised() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("first initialise should succeed");

    let start_slot = current_slot(&svm) + 20;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "second initialise should fail");
    assert_err_logs_contain(&result, "already in use");
}

#[test]
fn fails_to_initialise_a_round_if_not_after_current_slot() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    svm.warp_to_slot(20);

    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, 10);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "initialise with past slot should fail");
    assert_err_logs_contain(&result, "start slot must be greater than the current slot");
}

// Round activation

#[test]
fn authority_user_activates_a_round_at_start_slot() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("activate should succeed");

    let round = fetch_round(&svm, &pda).expect("round account should exist");
    assert_eq!(round.activated_by, Some(authority.pubkey()));
    assert_eq!(round.activated_at, Some(start_slot));
}

#[test]
fn non_authority_user_activates_a_round_at_start_slot() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);

    let activator = Keypair::new();
    svm.airdrop(&activator.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let instr = build_activate_round_instr(&activator.pubkey(), &pda);
    send_instr(&mut svm, instr, &activator).expect("activate should succeed");

    let round = fetch_round(&svm, &pda).expect("round account should exist");
    assert_eq!(round.activated_by, Some(activator.pubkey()));
    assert_eq!(round.activated_at, Some(start_slot));
}

#[test]
fn round_activated_after_start_slot() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let activate_at = start_slot + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(activate_at);

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("activate should succeed");

    let round = fetch_round(&svm, &pda).expect("round account should exist");
    assert_eq!(round.activated_at, Some(activate_at));
}

#[test]
fn fails_to_activate_a_round_if_not_initialised() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "activate without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}

#[test]
fn fails_to_activate_a_round_if_already_active() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("first activate should succeed");

    // LiteSVM was rejecting the second identical txn as `AlreadyProcessed`,
    // as the same instr w/ the same signer and same blockhash produces an identical txn hash.
    // Expiring the blockhash forces a new one, making the txns distinct.
    svm.expire_blockhash();

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "second activate should fail");
    assert_err_logs_contain(&result, "RoundAlreadyActive");
}

#[test]
fn fails_to_activate_a_round_if_not_after_current_slot() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(current_slot(&svm) + 5);

    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "activate before start slot should fail");
    assert_err_logs_contain(
        &result,
        "current slot must be greater than or equal to the start slot",
    );
}

// Round completion

#[test]
fn completes_a_round() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let complete_slot = start_slot + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);
    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("activate should succeed");

    svm.warp_to_slot(complete_slot);
    let instr = build_complete_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("complete should succeed");

    let round = fetch_round(&svm, &pda).expect("round account should exist");
    assert_eq!(round.completed_at, Some(complete_slot));
}

#[test]
fn fails_to_complete_a_round_if_signer_is_not_authority() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let complete_slot = start_slot + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);
    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("activate should succeed");

    svm.warp_to_slot(complete_slot);
    let non_authority = Keypair::new();
    svm.airdrop(&non_authority.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();
    let instr = build_complete_round_instr(&non_authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &non_authority);
    assert!(result.is_err(), "complete by non-authority should fail");
    assert_err_logs_contain(&result, "ConstraintHasOne");
}

#[test]
fn fails_to_complete_a_round_if_not_active() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let instr = build_complete_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "complete without activate should fail");
    assert_err_logs_contain(&result, "round has not yet been activated");
}

#[test]
fn fails_to_complete_a_round_if_already_completed() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let start_slot = current_slot(&svm) + 10;
    let complete_slot = start_slot + 10;
    let instr = build_initialise_round_instr(&authority.pubkey(), &pda, start_slot);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    svm.warp_to_slot(start_slot);
    let instr = build_activate_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("activate should succeed");

    svm.warp_to_slot(complete_slot);
    let instr = build_complete_round_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("first complete should succeed");

    // LiteSVM was rejecting the second identical txn as `AlreadyProcessed`,
    // as the same instr w/ the same signer and same blockhash produces an identical txn hash.
    // Expiring the blockhash forces a new one, making the txns distinct.
    svm.expire_blockhash();

    let instr = build_complete_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "second complete should fail");
    assert_err_logs_contain(&result, "RoundAlreadyComplete");
}

#[test]
fn fails_to_complete_a_round_if_not_initialised() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = round_pda(&authority.pubkey());

    let instr = build_complete_round_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "complete without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}
