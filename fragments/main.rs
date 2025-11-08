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
mod sqlite_db;

fn main() {
    // env vars
    println!(
        "fragment 'env_vars' output: {}",
        env_vars::env_vars_utils::get_env_var("REPO_NAME")
    );

    // sqlite
    println!(
        "fragment 'sqlite_db/get_item_by_ticker' output: {:?}",
        sqlite_db::sqlite_crud::get_item_by_ticker("BTC")
            .unwrap_or_else(|e| panic!("Expected item by ticker result but got error: {:?}", e))
    );

    let sqlite_db_items_after_launch_year =
        sqlite_db::sqlite_crud::get_items_after_launch_year(2010)
            .unwrap_or_else(|e| panic!("Expected coins after launch year but got error: {:?}", e));
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - found {} items",
        sqlite_db_items_after_launch_year.len()
    );
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - item 1: {}",
        sqlite_db_items_after_launch_year[0]
    );
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - item 2: {}",
        sqlite_db_items_after_launch_year[1]
    );

    println!(
        "fragment 'sqlite_db/get_all_items' - found {} items",
        sqlite_db::sqlite_crud::get_all_items()
            .unwrap_or_else(|e| panic!("Expected coins but got error: {:?}", e))
            .len()
    );
    println!(
        "fragment 'sqlite_db/add_item' output: {:?}",
        sqlite_db::sqlite_crud::add_item("PEPE", "Pepe", 2023)
            .unwrap_or_else(|e| panic!("Expected to add item but got error: {:?}", e))
    );
    println!(
        "fragment 'sqlite_db/update_item' output: {:?}",
        sqlite_db::sqlite_crud::update_item("BTC", "Bitcoin", 2008)
            .unwrap_or_else(|e| panic!("Expected to update item but got error: {:?}", e))
    );
    println!(
        "fragment 'sqlite_db/delete_item' output: {:?}",
        sqlite_db::sqlite_crud::delete_item("ETH")
            .unwrap_or_else(|e| panic!("Expected to delete item but got error: {:?}", e))
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
