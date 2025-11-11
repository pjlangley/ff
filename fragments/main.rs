use solana_sdk::{native_token::LAMPORTS_PER_SOL, signature::Keypair, signer::Signer};

mod env_vars;
mod solana_airdrop;
mod solana_balance;
mod solana_program;
mod solana_program_counter;
mod solana_program_round;
mod solana_program_username;
mod solana_rpc;
mod solana_transaction;

fn main() {
    // env vars
    println!(
        "fragment 'env_vars' output: {}",
        env_vars::env_vars_utils::get_env_var("REPO_NAME")
    );

    let solana_keypair = Keypair::new();
    let solana_address = solana_keypair.pubkey();

    // solana balance
    println!(
        "fragment 'solana_balance/get_balance' output: {:?}",
        solana_balance::solana_balance_utils::get_balance(solana_address)
            .unwrap_or_else(|e| panic!("Expected balance but got error: {:?}", e))
    );

    // solana rpc utils
    let solana_rpc_client = solana_rpc::solana_rpc_utils::init_rpc_client();
    println!(
        "fragment 'solana_rpc/init_rpc_client get_version' output: {:?}",
        solana_rpc_client
            .get_version()
            .unwrap_or_else(|e| panic!("Expected version but got error: {:?}", e))
    );

    // solana airdrop
    println!(
        "fragment 'solana_airdrop/send_and_confirm_airdrop' output: {:?}",
        solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop(
            solana_address,
            LAMPORTS_PER_SOL
        )
        .unwrap_or_else(|e| panic!("Expected confirmed airdrop but got error: {:?}", e))
    );
}
