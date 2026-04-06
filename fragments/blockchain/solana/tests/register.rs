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

fn registry_state_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"registry_state"], &register::ID)
}

fn registration_pda(registrant: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"registration", registrant.as_ref()], &register::ID)
}

fn build_initialise_registry_instr(authority: &Pubkey, registry_state_pda: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        register::ID,
        &anchor_discriminator("initialise_registry"),
        vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*registry_state_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn build_register_instr(
    registrant: &Pubkey,
    registry_state_pda: &Pubkey,
    registration_pda: &Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        register::ID,
        &anchor_discriminator("register"),
        vec![
            AccountMeta::new(*registrant, true),
            AccountMeta::new(*registry_state_pda, false),
            AccountMeta::new(*registration_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    )
}

fn build_confirm_registration_instr(
    authority: &Pubkey,
    registry_state_pda: &Pubkey,
    registration_pda: &Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        register::ID,
        &anchor_discriminator("confirm_registration"),
        vec![
            AccountMeta::new_readonly(*registry_state_pda, false),
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*registration_pda, false),
        ],
    )
}

fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(register::ID, "../target/deploy/register.so")
        .expect("Failed to load register program");
    svm
}

fn fetch_registry_state(svm: &LiteSVM, pda: &Pubkey) -> Option<register::RegistryState> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    register::RegistryState::try_deserialize(&mut data).ok()
}

fn fetch_registration(svm: &LiteSVM, pda: &Pubkey) -> Option<register::Registration> {
    let account = svm.get_account(pda)?;
    let mut data = account.data.as_slice();
    register::Registration::try_deserialize(&mut data).ok()
}

// Initialisation

#[test]
fn initialises_the_registry() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let state = fetch_registry_state(&svm, &pda).expect("registry state should exist");
    assert_eq!(state.authority, authority.pubkey());
    assert_eq!(state.registration_count, 0);
}

#[test]
fn fails_to_initialise_registry_if_already_initialised() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &pda);
    send_instr(&mut svm, instr, &authority).expect("first initialise should succeed");

    // LiteSVM rejects identical txns as `AlreadyProcessed`.
    // Expiring the blockhash forces a new one, making the txns distinct.
    svm.expire_blockhash();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "second initialise should fail");
    assert_err_logs_contain(&result, "already in use");
}

#[test]
fn fails_to_fetch_registry_state_if_not_initialised() {
    let svm = setup();
    let (pda, _) = registry_state_pda();

    let state = fetch_registry_state(&svm, &pda);
    assert!(state.is_none(), "registry state should not exist");
}

// Registration

#[test]
fn registers_a_user() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &user).expect("register should succeed");

    let registration = fetch_registration(&svm, &reg_pda).expect("registration should exist");
    assert_eq!(registration.registrant, user.pubkey());
    assert_eq!(registration.registration_index, 0);
    assert_eq!(registration.confirmed_at, None);

    let state = fetch_registry_state(&svm, &state_pda).expect("registry state should exist");
    assert_eq!(state.registration_count, 1);
}

#[test]
fn registers_multiple_users_with_incrementing_index() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    for i in 0..3 {
        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
        let (reg_pda, _) = registration_pda(&user.pubkey());

        let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
        send_instr(&mut svm, instr, &user).expect("register should succeed");

        let registration = fetch_registration(&svm, &reg_pda).expect("registration should exist");
        assert_eq!(registration.registration_index, i);
    }

    let state = fetch_registry_state(&svm, &state_pda).expect("registry state should exist");
    assert_eq!(state.registration_count, 3);
}

#[test]
fn fails_to_register_if_already_registered() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &user).expect("first register should succeed");

    // LiteSVM rejects identical txns as `AlreadyProcessed`.
    // Expiring the blockhash forces a new one, making the txns distinct.
    svm.expire_blockhash();

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &user);
    assert!(result.is_err(), "second register should fail");
    assert_err_logs_contain(&result, "already in use");
}

#[test]
fn fails_to_register_if_registry_not_initialised() {
    let mut svm = setup();
    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &user);
    assert!(result.is_err(), "register without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}

// Confirm registration

#[test]
fn authority_confirms_a_registration() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &user).expect("register should succeed");

    let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &authority).expect("confirm should succeed");

    let registration = fetch_registration(&svm, &reg_pda).expect("registration should exist");
    assert!(
        registration.confirmed_at.is_some(),
        "confirmed_at should be set"
    );
}

#[test]
fn fails_to_confirm_if_signer_is_not_authority() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &user).expect("register should succeed");

    let non_authority = Keypair::new();
    svm.airdrop(&non_authority.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();
    let instr = build_confirm_registration_instr(&non_authority.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &non_authority);
    assert!(result.is_err(), "confirm by non-authority should fail");
    assert_err_logs_contain(&result, "ConstraintHasOne");
}

#[test]
fn fails_to_confirm_if_registration_not_found() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let unknown_user = Keypair::new();
    let (reg_pda, _) = registration_pda(&unknown_user.pubkey());

    let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "confirm non-existent should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}

#[test]
fn fails_to_confirm_if_already_confirmed() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (reg_pda, _) = registration_pda(&user.pubkey());

    let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &user).expect("register should succeed");

    let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, &reg_pda);
    send_instr(&mut svm, instr, &authority).expect("first confirm should succeed");

    // LiteSVM rejects identical txns as `AlreadyProcessed`.
    // Expiring the blockhash forces a new one, making the txns distinct.
    svm.expire_blockhash();

    let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "second confirm should fail");
    assert_err_logs_contain(&result, "RegistrationAlreadyConfirmed");
}

#[test]
fn fails_to_confirm_if_registry_not_initialised() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let unknown_user = Keypair::new();
    let (reg_pda, _) = registration_pda(&unknown_user.pubkey());

    let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, &reg_pda);
    let result = send_instr(&mut svm, instr, &authority);
    assert!(result.is_err(), "confirm without initialise should fail");
    assert_err_logs_contain(&result, "AccountNotInitialized");
}

#[test]
fn confirms_multiple_registrations_in_fifo_order() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let mut reg_pdas = Vec::new();
    for _ in 0..3 {
        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
        let (reg_pda, _) = registration_pda(&user.pubkey());

        let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
        send_instr(&mut svm, instr, &user).expect("register should succeed");

        reg_pdas.push(reg_pda);
    }

    // Confirm in FIFO order (index 0, 1, 2)
    for (i, reg_pda) in reg_pdas.iter().enumerate() {
        let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, reg_pda);
        send_instr(&mut svm, instr, &authority).expect("confirm should succeed");

        let registration = fetch_registration(&svm, reg_pda).expect("registration should exist");
        assert_eq!(registration.registration_index, i as u64);
        assert!(registration.confirmed_at.is_some());
    }
}

#[test]
fn confirms_registrations_out_of_fifo_order() {
    let mut svm = setup();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let (state_pda, _) = registry_state_pda();

    let instr = build_initialise_registry_instr(&authority.pubkey(), &state_pda);
    send_instr(&mut svm, instr, &authority).expect("initialise should succeed");

    let mut reg_pdas = Vec::new();
    for _ in 0..3 {
        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), LAMPORTS_PER_SOL).unwrap();
        let (reg_pda, _) = registration_pda(&user.pubkey());

        let instr = build_register_instr(&user.pubkey(), &state_pda, &reg_pda);
        send_instr(&mut svm, instr, &user).expect("register should succeed");

        reg_pdas.push(reg_pda);
    }

    // Confirm in reverse order (not FIFO)
    for (i, reg_pda) in reg_pdas.iter().enumerate().rev() {
        let instr = build_confirm_registration_instr(&authority.pubkey(), &state_pda, reg_pda);
        send_instr(&mut svm, instr, &authority).expect("confirm should succeed");

        let registration = fetch_registration(&svm, reg_pda).expect("registration should exist");
        assert_eq!(registration.registration_index, i as u64);
        assert!(registration.confirmed_at.is_some());
    }
}
