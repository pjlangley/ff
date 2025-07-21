// https://stackoverflow.com/questions/79225593
#![allow(unexpected_cfgs)]

use std::str;

use anchor_lang::prelude::*;

declare_id!("5kS2nb5CSCVcdb4N7iA1kQuAZYKFttXagoHv2TxWmzg9");

#[program]
pub mod round {
    use super::*;

    // IRL only an admin can initialise a round
    pub fn initialise_round(ctx: Context<InitialiseRound>, start_slot: u64) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let current_slot = Clock::get()?.slot;

        require!(start_slot > current_slot, RoundError::InvalidStartSlot);

        round.start_slot = start_slot;
        round.authority = ctx.accounts.authority.key();

        msg!(
            "Round {} initialised by {}",
            start_slot,
            ctx.accounts.authority.key()
        );

        Ok(())
    }

    pub fn activate_round(ctx: Context<ActivateRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let current_slot = Clock::get()?.slot;

        require!(round.activated_at.is_none(), RoundError::RoundAlreadyActive);
        require!(
            current_slot >= round.start_slot,
            RoundError::InvalidRoundActivationSlot
        );

        round.activated_by = Some(ctx.accounts.user.key());
        round.activated_at = Some(current_slot);

        msg!(
            "Round {} activated by {} at slot {}",
            round.start_slot,
            ctx.accounts.user.key(),
            current_slot
        );

        Ok(())
    }

    pub fn complete_round(ctx: Context<CompleteRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let current_slot = Clock::get()?.slot;

        require!(round.activated_at.is_some(), RoundError::RoundNotYetActive);
        require!(
            round.completed_at.is_none(),
            RoundError::RoundAlreadyComplete
        );

        round.completed_at = Some(current_slot);

        msg!(
            "Round {} marked as complete at slot {}",
            round.start_slot,
            current_slot
        );

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub start_slot: u64,
    pub authority: Pubkey,
    pub activated_at: Option<u64>,
    pub activated_by: Option<Pubkey>,
    pub completed_at: Option<u64>,
}

#[derive(Accounts)]
pub struct InitialiseRound<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", authority.key().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActivateRound<'info> {
    #[account(
        mut,
        seeds = [b"round", round.authority.as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteRound<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [b"round", round.authority.as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    pub authority: Signer<'info>,
}

#[error_code]
pub enum RoundError {
    #[msg("The start slot must be greater than the current slot")]
    InvalidStartSlot,

    #[msg("The round is already active")]
    RoundAlreadyActive,

    #[msg("The round has not yet been activated")]
    RoundNotYetActive,

    #[msg("The round is already complete")]
    RoundAlreadyComplete,

    #[msg("The current slot must be greater than or equal to the start slot")]
    InvalidRoundActivationSlot,
}
