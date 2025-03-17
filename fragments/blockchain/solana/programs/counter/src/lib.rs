use anchor_lang::prelude::*;

declare_id!("HdxpgGmRXeUpXE2vVZZCy2a69Ypozs8YLt3LXPHRUkG6");

#[program]
pub mod counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter initialised for {}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        msg!(
            "Counter incremented to {} for {}",
            counter.count,
            ctx.accounts.user.key()
        );
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub count: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(init, payer = user, space = 8 + Counter::INIT_SPACE)]
    pub counter: Account<'info, Counter>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub user: Signer<'info>,
}
