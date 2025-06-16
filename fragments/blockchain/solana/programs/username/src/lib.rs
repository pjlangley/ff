// https://stackoverflow.com/questions/79225593
#![allow(unexpected_cfgs)]

use std::fmt;

use anchor_lang::prelude::*;

declare_id!("uMeQ3a2zVJf1pVa4uFu2Y6i88S3soEq3Q2aJjod3VD8");

const MAX_USERNAME_HISTORY: usize = 3;
const MAX_USERNAME_LENGTH: usize = 32;
const MIN_USERNAME_LENGTH: usize = 2;

#[program]
pub mod username {
    use super::*;

    pub fn initialize_username(ctx: Context<InitializeUsername>, username: Username) -> Result<()> {
        let username = Username::new(username.value)?;
        let user_account = &mut ctx.accounts.user_account;
        user_account.authority = ctx.accounts.authority.key();
        user_account.username = username;
        user_account.change_count = 0;
        user_account.username_recent_history = vec![];

        msg!(
            "Username {} assigned to {}",
            user_account.username.clone(),
            ctx.accounts.authority.key()
        );

        Ok(())
    }

    pub fn update_username(ctx: Context<UpdateUsername>, username: Username) -> Result<()> {
        let username = Username::new(username.value)?;
        let user_account = &mut ctx.accounts.user_account;

        if username.value == user_account.username.value {
            return Err(error!(UsernameError::UsernameAlreadyAssigned));
        }

        // Save old username into PDA history
        // (full history, unlimited length, audit trail)
        let record = &mut ctx.accounts.username_record;
        record.authority = ctx.accounts.authority.key();
        record.old_username = user_account.username.clone();
        record.change_index = user_account.change_count;

        // Also save old username into recent change history
        // (quick access, limited length, probably covers most user behaviour)
        let old_username = user_account.username.clone();
        if user_account.username_recent_history.len() >= MAX_USERNAME_HISTORY {
            user_account.username_recent_history.remove(0);
        }
        user_account.username_recent_history.push(old_username);

        // Update the username on account
        user_account.username = username;
        user_account.change_count += 1;

        msg!(
            "Username {} assigned to {}",
            user_account.username.clone(),
            ctx.accounts.authority.key()
        );
        msg!(
            "Username has been updated {} time(s) for {}",
            user_account.change_count + 1,
            ctx.accounts.authority.key()
        );

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Username {
    #[max_len(32)] // must match MAX_USERNAME_LENGTH
    pub value: String,
}

impl Username {
    pub fn new(username: String) -> Result<Self> {
        let username = username.trim().to_string();

        if username.len() > MAX_USERNAME_LENGTH {
            return Err(error!(UsernameError::UsernameTooLong));
        }
        if username.len() < MIN_USERNAME_LENGTH {
            return Err(error!(UsernameError::UsernameTooShort));
        }
        if !username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Err(error!(UsernameError::UsernameInvalidCharacters));
        }

        Ok(Self { value: username })
    }
}

impl fmt::Display for Username {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub authority: Pubkey,
    pub username: Username,
    pub change_count: u64,

    #[max_len(3)] // must match MAX_USERNAME_HISTORY
    pub username_recent_history: Vec<Username>,
}

#[account]
#[derive(InitSpace)]
pub struct UsernameRecord {
    pub authority: Pubkey,
    pub old_username: Username,
    pub change_index: u64,
}

#[derive(Accounts)]
pub struct InitializeUsername<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"user_account", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + UserAccount::INIT_SPACE
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateUsername<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority)]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        init,
        seeds = [b"username_record", authority.key().as_ref(), &user_account.change_count.to_le_bytes()],
        bump,
        payer = authority,
        space = 8 + UsernameRecord::INIT_SPACE
    )]
    pub username_record: Account<'info, UsernameRecord>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum UsernameError {
    // must match MAX_USERNAME_LENGTH
    #[msg("Username is too long (maximum length is 32 characters)")]
    UsernameTooLong,

    // must match MIN_USERNAME_LENGTH
    #[msg("Username is too short (minimum length is 2 characters)")]
    UsernameTooShort,

    #[msg("Username contains invalid characters (only ascii alphanumeric, underscores, and hyphens are allowed)")]
    UsernameInvalidCharacters,

    #[msg("Username is already assigned")]
    UsernameAlreadyAssigned,
}
