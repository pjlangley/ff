// https://stackoverflow.com/questions/79225593
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;

declare_id!("DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K");

const ACCOUNT_DISCRIMINATOR_SPACE: usize = 8;

#[program]
pub mod register {
    use super::*;

    pub fn initialise_registry(ctx: Context<InitialiseRegistry>) -> Result<()> {
        let registry_state = &mut ctx.accounts.registry_state;
        registry_state.authority = ctx.accounts.authority.key();
        registry_state.registration_count = 0;
        msg!("Registry initialised by {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn register(ctx: Context<Register>) -> Result<()> {
        let registry_state = &mut ctx.accounts.registry_state;
        let registration = &mut ctx.accounts.registration;
        let clock = Clock::get()?;

        registration.registrant = ctx.accounts.registrant.key();
        registration.registration_index = registry_state.registration_count;
        registration.registered_at = clock.slot;
        registration.confirmed_at = None;

        registry_state.registration_count += 1;

        emit!(RegisteredEvent {
            registrant: registration.registrant,
            registration_index: registration.registration_index,
            registered_at: registration.registered_at,
        });

        msg!(
            "Registrant {} registered at index {}",
            ctx.accounts.registrant.key(),
            registration.registration_index
        );

        Ok(())
    }

    pub fn confirm_registration(ctx: Context<ConfirmRegistration>) -> Result<()> {
        let registration = &mut ctx.accounts.registration;
        let clock = Clock::get()?;

        require!(
            registration.confirmed_at.is_none(),
            RegisterError::RegistrationAlreadyConfirmed
        );

        registration.confirmed_at = Some(clock.slot);

        emit!(ConfirmedEvent {
            registrant: registration.registrant,
            registration_index: registration.registration_index,
            confirmed_at: clock.slot,
        });

        msg!(
            "Registration confirmed for {} at index {}",
            registration.registrant,
            registration.registration_index
        );

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct RegistryState {
    pub authority: Pubkey,
    pub registration_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Registration {
    pub registrant: Pubkey,
    pub registration_index: u64,
    pub registered_at: u64,
    pub confirmed_at: Option<u64>,
}

#[derive(Accounts)]
pub struct InitialiseRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"registry_state"],
        bump,
        payer = authority,
        space = ACCOUNT_DISCRIMINATOR_SPACE + RegistryState::INIT_SPACE
    )]
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        address = Pubkey::find_program_address(
            &[crate::ID.as_ref()],
            &bpf_loader_upgradeable::id()
        ).0,
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ RegisterError::Unauthorised
    )]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub registrant: Signer<'info>,

    #[account(
        mut,
        seeds = [b"registry_state"],
        bump
    )]
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        init,
        seeds = [b"registration", registrant.key().as_ref()],
        bump,
        payer = registrant,
        space = ACCOUNT_DISCRIMINATOR_SPACE + Registration::INIT_SPACE
    )]
    pub registration: Account<'info, Registration>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmRegistration<'info> {
    #[account(
        seeds = [b"registry_state"],
        bump,
        has_one = authority
    )]
    pub registry_state: Account<'info, RegistryState>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"registration", registration.registrant.as_ref()],
        bump
    )]
    pub registration: Account<'info, Registration>,
}

#[event]
pub struct RegisteredEvent {
    pub registrant: Pubkey,
    pub registration_index: u64,
    pub registered_at: u64,
}

#[event]
pub struct ConfirmedEvent {
    pub registrant: Pubkey,
    pub registration_index: u64,
    pub confirmed_at: u64,
}

#[error_code]
pub enum RegisterError {
    #[msg("The registration has already been confirmed")]
    RegistrationAlreadyConfirmed,
    #[msg("Signer is not the program upgrade authority")]
    Unauthorised,
}
