use crate::env_vars::env_vars_utils::get_env_var;
use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;
use crate::solana_program_username::solana_username_interface::{
    get_username_account, get_username_record_account, initialise_username, update_username,
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

#[derive(serde::Deserialize)]
struct UsernameBody {
    username: String,
}

// In-memory storage for keypairs
// In production, use a secure key management service or encrypted database
static KEYPAIR_STORAGE: Lazy<Mutex<HashMap<String, Keypair>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static PROGRAM_ID: Lazy<Pubkey> = Lazy::new(|| {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let env_path = manifest_dir.join("solana_program_keys/solana_program_keys.env");
    dotenvy::from_path(&env_path).ok();

    Pubkey::from_str(&get_env_var("username_PROGRAM_ID")).expect("Failed to parse program id")
});

pub fn solana_username_routes() -> Router {
    Router::new()
        .route("/username/initialise", post(initialise_username_handler))
        .route("/username/{address}", get(get_username_handler))
        .route("/username/{address}", patch(update_username_handler))
        .route(
            "/username/{address}/record/{change_index}",
            get(get_username_record_handler),
        )
}

async fn initialise_username_handler(Json(payload): Json<UsernameBody>) -> impl IntoResponse {
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

    let keypair_bytes = keypair.to_bytes();
    {
        let mut storage = KEYPAIR_STORAGE.lock().unwrap();
        storage.insert(
            pubkey.to_string(),
            Keypair::from_bytes(&keypair_bytes).unwrap(),
        );
    }

    let result = tokio::spawn(async move {
        initialise_username(
            &Keypair::from_bytes(&keypair_bytes).unwrap(),
            *PROGRAM_ID,
            &payload.username,
        )
        .await
    })
    .await;

    match result {
        Ok(Ok(_signature)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "address": pubkey.to_string() })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to initialise username"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn get_username_handler(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result =
        tokio::spawn(async move { get_username_account(&keypair.pubkey(), *PROGRAM_ID).await })
            .await;

    match result {
        Ok(Ok(account)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "authority": account.authority.to_string(),
                "username": account.username.value,
                "change_count": account.change_count,
                "username_recent_history": account
                    .username_recent_history
                    .iter()
                    .map(|u| &u.value)
                    .collect::<Vec<_>>(),
            })),
        )
            .into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to fetch username account"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn update_username_handler(
    AxumPath(address): AxumPath<String>,
    Json(payload): Json<UsernameBody>,
) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let keypair_bytes = keypair.to_bytes();
    let result = tokio::spawn(async move {
        update_username(
            &Keypair::from_bytes(&keypair_bytes).unwrap(),
            *PROGRAM_ID,
            &payload.username,
        )
        .await
    })
    .await;

    match result {
        Ok(Ok(_signature)) => (StatusCode::OK).into_response(),
        Ok(Err(e)) => handle_solana_rpc_error(e, "Failed to update username"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn get_username_record_handler(
    AxumPath((address, change_index)): AxumPath<(String, u64)>,
) -> impl IntoResponse {
    let keypair = {
        let storage = KEYPAIR_STORAGE.lock().unwrap();
        let stored = match storage.get(&address) {
            Some(kp) => kp,
            None => return StatusCode::NOT_FOUND.into_response(),
        };
        Keypair::from_bytes(&stored.to_bytes()).unwrap()
    };

    let result = tokio::spawn(async move {
        get_username_record_account(&keypair.pubkey(), *PROGRAM_ID, change_index).await
    })
    .await;

    match result {
        Ok(Ok(account)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "old_username": account.old_username.value,
                "change_index": account.change_index,
                "authority": account.authority.to_string(),
            })),
        )
            .into_response(),
        Ok(Err(e)) => {
            let err_string = e.to_string();
            if err_string.contains("AccountNotFound") {
                return StatusCode::NOT_FOUND.into_response();
            }
            handle_solana_rpc_error(e, "Failed to fetch username record")
        }
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
    use crate::apis::axum::app::build_app;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_initialise_username_and_get() {
        let app = build_app();
        let body = serde_json::json!({ "username": "alice" });
        let init_request = Request::post("/solana/username/initialise")
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_response_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_response_json["address"].as_str().unwrap();

        let get_request = Request::get(format!("/solana/username/{}", address))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let get_response_body = get_response.into_body().collect().await.unwrap().to_bytes();
        let get_response_json: Value = serde_json::from_slice(&get_response_body).unwrap();

        assert_eq!(get_response_json["authority"], address);
        assert_eq!(get_response_json["username"], "alice");
        assert_eq!(get_response_json["change_count"], 0);
        assert_eq!(
            get_response_json["username_recent_history"],
            serde_json::json!([])
        );
    }

    #[tokio::test]
    async fn test_get_non_existent_username() {
        let app = build_app();
        let get_request = Request::get("/solana/username/11111111111111111111111111111111")
            .body(Body::empty())
            .unwrap();
        let get_response = app.oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_update_username() {
        let app = build_app();
        let body = serde_json::json!({ "username": "alice" });
        let init_request = Request::post("/solana/username/initialise")
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_response_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_response_json["address"].as_str().unwrap();

        let update_body = serde_json::json!({ "username": "bob" });
        let update_request = Request::patch(format!("/solana/username/{}", address))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_body).unwrap()))
            .unwrap();
        let update_response = app.clone().oneshot(update_request).await.unwrap();
        assert_eq!(update_response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/solana/username/{}", address))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let get_response_body = get_response.into_body().collect().await.unwrap().to_bytes();
        let get_response_json: Value = serde_json::from_slice(&get_response_body).unwrap();
        assert_eq!(get_response_json["username"], "bob");
        assert_eq!(get_response_json["change_count"], 1);
        assert_eq!(
            get_response_json["username_recent_history"],
            serde_json::json!(["alice"])
        );
    }

    #[tokio::test]
    async fn test_update_non_existent_username() {
        let app = build_app();
        let update_body = serde_json::json!({ "username": "bob" });
        let update_request = Request::patch("/solana/username/11111111111111111111111111111111")
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_body).unwrap()))
            .unwrap();
        let update_response = app.oneshot(update_request).await.unwrap();
        assert_eq!(update_response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_get_username_record() {
        let app = build_app();
        let body = serde_json::json!({ "username": "alice" });
        let init_request = Request::post("/solana/username/initialise")
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap();
        let init_response = app.clone().oneshot(init_request).await.unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);

        let init_response_body = init_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let init_response_json: Value = serde_json::from_slice(&init_response_body).unwrap();
        let address = init_response_json["address"].as_str().unwrap();

        let update_body = serde_json::json!({ "username": "bob" });
        let update_request = Request::patch(format!("/solana/username/{}", address))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_body).unwrap()))
            .unwrap();
        let update_response = app.clone().oneshot(update_request).await.unwrap();
        assert_eq!(update_response.status(), StatusCode::OK);

        let record_request = Request::get(format!("/solana/username/{}/record/0", address))
            .body(Body::empty())
            .unwrap();
        let record_response = app.clone().oneshot(record_request).await.unwrap();
        assert_eq!(record_response.status(), StatusCode::OK);

        let record_response_body = record_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let record_response_json: Value = serde_json::from_slice(&record_response_body).unwrap();
        assert_eq!(record_response_json["old_username"], "alice");
        assert_eq!(record_response_json["change_index"], 0);
        assert_eq!(record_response_json["authority"], address);
    }

    #[tokio::test]
    async fn test_get_non_existent_username_record() {
        let app = build_app();
        let record_request =
            Request::get("/solana/username/11111111111111111111111111111111/record/0")
                .body(Body::empty())
                .unwrap();
        let record_response = app.oneshot(record_request).await.unwrap();
        assert_eq!(record_response.status(), StatusCode::NOT_FOUND);
    }
}
