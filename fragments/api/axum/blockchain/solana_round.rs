use crate::env_vars::env_vars_utils::get_env_var;
use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;
use crate::solana_program_round::solana_round_interface::{
    activate_round, complete_round, get_round_account, initialise_round,
};
use crate::solana_rpc::solana_rpc_utils::init_rpc_client;
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

    Pubkey::from_str(&get_env_var("round_PROGRAM_ID")).expect("Failed to parse program id")
});

pub fn solana_round_routes() -> Router {
    Router::new()
        .route("/round/initialise", post(initialise_round_handler))
        .route("/round/{address}", get(get_round_handler))
        .route("/round/{address}/activate", patch(activate_round_handler))
        .route("/round/{address}/complete", patch(complete_round_handler))
}

async fn initialise_round_handler() -> impl IntoResponse {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey();
    let pubkey_clone = keypair.pubkey();
    let client = init_rpc_client();

    let airdrop_result =
        tokio::spawn(async move { send_and_confirm_airdrop(pubkey_clone, LAMPORTS_PER_SOL).await })
            .await;

    match airdrop_result {
        Ok(Ok(_)) => eprintln!("Airdrop successful to address: {}", pubkey),
        Ok(Err(e)) => return handle_solana_rpc_error(e, "Failed to airdrop SOL"),
        Err(join_err) => return handle_join_error(join_err),
    };

    let keypair_bytes = keypair.to_bytes();
    {
        let mut storage = KEYPAIR_STORAGE.lock().unwrap();
        storage.insert(
            pubkey.to_string(),
            Keypair::from_bytes(&keypair_bytes).unwrap(),
        );
    }

    let recent_slot = match client.get_slot().await {
        Ok(slot) => slot,
        Err(e) => return handle_solana_rpc_error(e, "Failed to get recent slot"),
    };
    let start_slot = recent_slot + 3;

    let result = tokio::spawn(async move {
        initialise_round(
            &Keypair::from_bytes(&keypair_bytes).unwrap(),
            *PROGRAM_ID,
            start_slot,
        )
        .await
    })
    .await;

    match result {
        Ok(Ok(_signature)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "address": pubkey.to_string(), "start_slot": start_slot })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to initialise round"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn get_round_handler(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result =
        tokio::spawn(async move { get_round_account(&keypair.pubkey(), *PROGRAM_ID).await }).await;

    match result {
        Ok(Ok(account)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "start_slot": account.start_slot.to_string(),
                "authority": account.authority.to_string(),
                "activated_at": account.activated_at.map(|x| x.to_string()),
                "activated_by": account.activated_by.map(|x| x.to_string()),
                "completed_at": account.completed_at.map(|x| x.to_string()),
            })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to fetch round"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn activate_round_handler(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result =
        tokio::spawn(async move { activate_round(&keypair, *PROGRAM_ID, &keypair.pubkey()).await })
            .await;

    match result {
        Ok(Ok(_signature)) => StatusCode::OK.into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to activate round"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn complete_round_handler(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result = tokio::spawn(async move { complete_round(&keypair, *PROGRAM_ID).await }).await;

    match result {
        Ok(Ok(_signature)) => StatusCode::OK.into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to complete round"),
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
    use crate::api::axum::app::build_app;
    use crate::solana_rpc::solana_rpc_utils::wait_for_slot;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_solana_round_initialise_and_get() {
        let app = build_app();
        let init_request = Request::post("/solana/round/initialise")
            .body(Body::empty())
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_body_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_body_json.get("address").unwrap().as_str().unwrap();

        let get_request = Request::get(format!("/solana/round/{}", address))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let body_bytes = get_response.into_body().collect().await.unwrap().to_bytes();
        let body_json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(body_json["start_slot"].is_string());
        assert_eq!(body_json["authority"], address);
        assert!(body_json["activated_at"].is_null());
        assert!(body_json["activated_by"].is_null());
        assert!(body_json["completed_at"].is_null());
    }

    #[tokio::test]
    async fn test_solana_round_activate() {
        let app = build_app();
        let init_request = Request::post("/solana/round/initialise")
            .body(Body::empty())
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_body_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_body_json["address"].as_str().unwrap().to_string();
        let start_slot = init_body_json["start_slot"].as_u64().unwrap();

        let is_at_slot = wait_for_slot(start_slot, None).await.unwrap();
        assert_eq!(is_at_slot, true);

        let activate_request = Request::patch(format!("/solana/round/{}/activate", address))
            .body(Body::empty())
            .unwrap();
        let activate_response = app.clone().oneshot(activate_request).await.unwrap();
        assert_eq!(activate_response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/solana/round/{}", address))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let body_bytes = get_response.into_body().collect().await.unwrap().to_bytes();
        let body_json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(body_json["activated_at"].is_string());
        assert_eq!(body_json["activated_by"], address);
    }

    #[tokio::test]
    async fn test_solana_round_complete() {
        let app = build_app();
        let init_request = Request::post("/solana/round/initialise")
            .body(Body::empty())
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_body_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_body_json["address"].as_str().unwrap().to_string();
        let start_slot = init_body_json["start_slot"].as_u64().unwrap();

        let is_at_slot = wait_for_slot(start_slot, None).await.unwrap();
        assert_eq!(is_at_slot, true);

        let activate_request = Request::patch(format!("/solana/round/{}/activate", address))
            .body(Body::empty())
            .unwrap();
        let activate_response = app.clone().oneshot(activate_request).await.unwrap();
        assert_eq!(activate_response.status(), StatusCode::OK);

        let complete_request = Request::patch(format!("/solana/round/{}/complete", address))
            .body(Body::empty())
            .unwrap();
        let complete_response = app.clone().oneshot(complete_request).await.unwrap();
        assert_eq!(complete_response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/solana/round/{}", address))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        let body_bytes = get_response.into_body().collect().await.unwrap().to_bytes();
        let body_json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(body_json["completed_at"].is_string());
    }

    #[tokio::test]
    async fn test_solana_round_get_not_found() {
        let app = build_app();
        let get_request = Request::get("/solana/round/11111111111111111111111111111111")
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }
}
