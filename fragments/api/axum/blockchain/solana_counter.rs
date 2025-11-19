use crate::env_vars::env_vars_utils::get_env_var;
use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;
use crate::solana_program_counter::solana_counter_interface::{
    get_count, increment_counter, initialize_account,
};
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, patch, post},
    Router,
};
use once_cell::sync::Lazy;
use solana_client::client_error::ClientError;
use solana_sdk::{
    native_token::LAMPORTS_PER_SOL, pubkey::Pubkey, signature::Keypair, signer::Signer,
};
use std::collections::HashMap;
use std::path::Path;
use std::str::FromStr;
use std::sync::Mutex;

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
static KEYPAIR_STORAGE: Lazy<Mutex<HashMap<String, Keypair>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static PROGRAM_ID: Lazy<Pubkey> = Lazy::new(|| {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let env_path = manifest_dir.join("solana_program_keys/solana_program_keys.env");
    dotenvy::from_path(&env_path).ok();

    Pubkey::from_str(&get_env_var("counter_PROGRAM_ID")).expect("Failed to parse program id")
});

pub fn solana_counter_routes() -> Router {
    Router::new()
        .route("/counter/initialise", post(initialise_counter))
        .route("/counter/{address}", get(get_counter))
        .route("/counter/{address}/increment", patch(increment))
}

async fn initialise_counter() -> impl IntoResponse {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey();
    let pubkey_clone = keypair.pubkey();

    let airdrop_result =
        tokio::spawn(async move { send_and_confirm_airdrop(pubkey_clone, LAMPORTS_PER_SOL).await })
            .await;

    match airdrop_result {
        Ok(Ok(_)) => eprintln!("Airdrop successful to address: {}", pubkey),
        Ok(Err(e)) => return handle_solana_rpc_error(e, "Failed to airdrop SOL"),
        Err(join_err) => return handle_join_error(join_err),
    };

    // Mutex guard dropped here to avoid holding it during async operations
    let keypair_bytes = keypair.to_bytes();
    {
        let mut storage = KEYPAIR_STORAGE.lock().unwrap();
        storage.insert(
            pubkey.to_string(),
            Keypair::from_bytes(&keypair_bytes).unwrap(),
        );
    }

    let result = tokio::spawn(async move {
        initialize_account(&Keypair::from_bytes(&keypair_bytes).unwrap(), &PROGRAM_ID).await
    })
    .await;

    match result {
        Ok(Ok(_signature)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "address": pubkey.to_string() })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to initialize counter"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn get_counter(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result = tokio::spawn(async move { get_count(&keypair, &PROGRAM_ID).await }).await;

    match result {
        Ok(Ok(counter)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "count": counter.count.to_string() })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to fetch counter"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn increment(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };
    let keypair_bytes = keypair.to_bytes();

    let result = tokio::spawn(async move { increment_counter(&keypair, &PROGRAM_ID).await }).await;

    match result {
        Ok(Ok(_)) => (),
        Ok(Err(e)) => return handle_solana_rpc_error(e, "Failed to increment counter"),
        Err(join_err) => return handle_join_error(join_err),
    }

    let get_result = tokio::spawn(async move {
        get_count(&Keypair::from_bytes(&keypair_bytes).unwrap(), &PROGRAM_ID).await
    })
    .await;

    match get_result {
        Ok(Ok(counter)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "new_count": counter.count.to_string() })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to fetch new counter value"),
        Err(join_err) => handle_join_error(join_err),
    }
}

fn handle_join_error(join_err: tokio::task::JoinError) -> Response {
    eprintln!("Task join error: {join_err}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": "internal failure" })),
    )
        .into_response()
}

fn handle_solana_rpc_error(error: ClientError, message: &str) -> Response {
    eprintln!("Solana RPC error: {error}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": message })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::axum::app::build_app;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_initialize_counter() {
        let app = build_app();
        let request = Request::post("/solana/counter/initialise")
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(json["address"].is_string());

        let get_request = Request::get(format!(
            "/solana/counter/{}",
            json["address"].as_str().unwrap()
        ))
        .body(Body::empty())
        .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let get_body_bytes = get_response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&get_body_bytes).unwrap();
        assert_eq!(json["count"], "0");
    }

    #[tokio::test]
    async fn test_increment_counter() {
        let app = build_app();
        let init_request = Request::post("/solana/counter/initialise")
            .body(Body::empty())
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let body_bytes = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        let address = json["address"].as_str().unwrap();

        let increment_request = Request::patch(format!("/solana/counter/{}/increment", address))
            .body(Body::empty())
            .unwrap();
        let increment_response = app.clone().oneshot(increment_request).await.unwrap();
        assert_eq!(increment_response.status(), StatusCode::OK);

        let increment_body_bytes = increment_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let json: Value = serde_json::from_slice(&increment_body_bytes).unwrap();
        assert_eq!(json["new_count"], "1");
    }

    #[tokio::test]
    async fn test_get_counter_not_found() {
        let app = build_app();
        let fake_address = "11111111111111111111111111111111";
        let request = Request::get(format!("/solana/counter/{}", fake_address))
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_increment_counter_not_found() {
        let app = build_app();
        let fake_address = "11111111111111111111111111111111";
        let request = Request::patch(format!("/solana/counter/{}/increment", fake_address))
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
