use crate::solana_balance::solana_balance_utils::get_balance;
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use solana_sdk::pubkey::Pubkey;

pub fn solana_balance_routes() -> Router {
    Router::new().route("/balance/{address}", get(get_balance_handler))
}

async fn get_balance_handler(AxumPath(address): AxumPath<String>) -> impl IntoResponse {
    let pubkey = match address.parse::<Pubkey>() {
        Ok(pk) => pk,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };

    let result = tokio::spawn(async move { get_balance(pubkey).await }).await;

    match result {
        Ok(Ok(balance)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "balance": balance })),
        )
            .into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Solana RPC error: {}", e),
        )
            .into_response(),
        Err(join_err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task join error: {}", join_err),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::axum::app::build_app;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use solana_sdk::{signature::Keypair, signer::Signer};
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_get_balance_handler() {
        let app = build_app();
        let keypair = Keypair::new();
        let request = Request::get(format!("/solana/balance/{}", keypair.pubkey()))
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(json["balance"].is_number());
    }

    #[tokio::test]
    async fn test_get_balance_handler_invalid_address() {
        let app = build_app();
        let request = Request::get("/solana/balance/invalid_address")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
