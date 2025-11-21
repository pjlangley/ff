mod env_vars;
mod postgres_db;
mod redis_db;
mod solana_airdrop;
mod solana_program;
mod solana_program_counter;
mod solana_program_username;
mod solana_rpc;
mod solana_transaction;
mod sqlite_db;
mod api {
    pub mod axum;
}

use crate::api::axum::app::build_app;
use crate::env_vars::env_vars_utils::get_env_var;

#[tokio::main]
async fn main() {
    let host = {
        let h = get_env_var("AXUM_HOST");
        if h.is_empty() {
            "localhost".to_string()
        } else {
            h
        }
    };

    let app = build_app();
    let listener = tokio::net::TcpListener::bind(format!("{}:3001", host))
        .await
        .unwrap();
    println!("Server listening at {}:3001", host);
    axum::serve(listener, app).await.unwrap();
}
