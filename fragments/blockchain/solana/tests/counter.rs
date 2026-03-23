use anchor_lang::AccountDeserialize;
use litesvm::LiteSVM;
use program_tests::{anchor_discriminator, assert_err_logs_contain, send_instr};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    system_program::ID as SYSTEM_PROGRAM_ID,
};

fn counter_pda(user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"counter", user.as_ref()], &counter::ID)
}

fn build_initialise_instr(user: &Pubkey, counter_pda: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        counter::ID,
        &anchor_discriminator("initialize"),
        vec![
            AccountMeta::new(*user, true),
            AccountMeta::new(*counter_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn build_increment_instr(user: &Pubkey, counter_pda: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        counter::ID,
        &anchor_discriminator("increment"),
        vec![
            AccountMeta::new(*counter_pda, false),
            AccountMeta::new(*user, true),
        ],
    )
}

fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(counter::ID, "../target/deploy/counter.so")
        .expect("Failed to load counter program");
    svm
}

fn fetch_counter(svm: &LiteSVM, pda: &Pubkey) -> Option<counter::Counter> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    counter::Counter::try_deserialize(&mut data).ok()
}

#[test]
fn initialises_and_increments_the_counter() {
    let mut svm = setup();
    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let (pda, _) = counter_pda(&user.pubkey());

    // Initialise
    let instr = build_initialise_instr(&user.pubkey(), &pda);
    send_instr(&mut svm, instr, &user).expect("initialise should succeed");

    let counter = fetch_counter(&svm, &pda).expect("counter account should exist");
    assert_eq!(counter.count, 0);

    // Increment
    let instr = build_increment_instr(&user.pubkey(), &pda);
    send_instr(&mut svm, instr, &user).expect("increment should succeed");

    let counter = fetch_counter(&svm, &pda).expect("counter account should exist");
    assert_eq!(counter.count, 1);
}

#[test]
fn fails_to_increment_if_initialise_was_not_called() {
    let mut svm = setup();
    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let (pda, _) = counter_pda(&user.pubkey());

    let instr = build_increment_instr(&user.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &user);
    assert!(result.is_err(), "increment without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}

#[test]
fn fails_to_get_account_if_it_does_not_exist() {
    let svm = setup();
    let user = Keypair::new();
    let (pda, _) = counter_pda(&user.pubkey());

    let counter = fetch_counter(&svm, &pda);
    assert!(counter.is_none(), "counter should not exist");
}
