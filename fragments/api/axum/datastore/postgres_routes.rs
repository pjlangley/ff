use crate::postgres_db::postgres_crud::{
    add_item, delete_item, get_all_items, get_item_by_ticker, get_items_after_launch_year,
    update_item,
};
use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::Deserialize;
use serde_json;

#[derive(Debug, Deserialize)]
struct Coin {
    name: String,
    launched: i16,
}

pub fn postgres_routes() -> Router {
    Router::new()
        .route("/coins", get(get_coins))
        .route(
            "/coins/{ticker}",
            get(get_coin_by_ticker)
                .put(add_coin)
                .patch(update_coin)
                .delete(delete_coin),
        )
        .route("/coins/after/{year}", get(get_coins_after_year))
}

async fn get_coins() -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(get_all_items).await;
    match result {
        Ok(Ok(coins)) => (StatusCode::OK, Json(coins)).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
    }
}

async fn get_coin_by_ticker(Path(ticker): Path<String>) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let result = tokio::task::spawn_blocking(move || get_item_by_ticker(&ticker)).await;
    match result {
        Ok(Ok(Some(coin))) => (StatusCode::OK, Json(coin)).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
    }
}

async fn get_coins_after_year(Path(year): Path<i16>) -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(move || get_items_after_launch_year(year)).await;
    match result {
        Ok(Ok(coins)) => (StatusCode::OK, Json(coins)).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
    }
}

async fn add_coin(Path(ticker): Path<String>, Json(payload): Json<Coin>) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let result =
        tokio::task::spawn_blocking(move || add_item(&ticker, &payload.name, payload.launched))
            .await;

    match result {
        Ok(Ok(_)) => (StatusCode::OK).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
    }
}

async fn update_coin(
    Path(ticker): Path<String>,
    Json(payload): Json<Coin>,
) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let result =
        tokio::task::spawn_blocking(move || update_item(&ticker, &payload.name, payload.launched))
            .await;

    match result {
        Ok(Ok(Some(coin))) => (StatusCode::OK, Json(coin)).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
    }
}

async fn delete_coin(Path(ticker): Path<String>) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let result = tokio::task::spawn_blocking(move || delete_item(&ticker)).await;

    match result {
        Ok(Ok(Some(_))) => (StatusCode::NO_CONTENT).into_response(),
        Ok(Ok(None)) => (StatusCode::NO_CONTENT).into_response(),
        Ok(Err(e)) => {
            eprintln!("DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database failure" })),
            )
                .into_response()
        }
        Err(join_err) => {
            eprintln!("Task join error: {join_err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "internal failure" })),
            )
                .into_response()
        }
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
    use tower::ServiceExt;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_get_coins() {
        let app = build_app();
        let request = Request::get("/postgres/coins").body(Body::empty()).unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert!(json.as_array().unwrap().len() > 0);
    }

    #[tokio::test]
    async fn test_get_known_coin_by_ticker() {
        let app = build_app();
        let request = Request::get("/postgres/coins/BTC")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["ticker"], "BTC");
        assert_eq!(json["name"], "Bitcoin");
        assert_eq!(json["launched"], 2009);
    }

    #[tokio::test]
    async fn test_get_unknown_coin_by_ticker() {
        let app = build_app();
        let request = Request::get("/postgres/coins/UNKNOWN")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_get_coin_by_ticker_lowercase() {
        let app = build_app();
        let request = Request::get("/postgres/coins/btc")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["ticker"], "BTC");
        assert_eq!(json["name"], "Bitcoin");
        assert_eq!(json["launched"], 2009);
    }

    #[tokio::test]
    async fn test_get_coins_after_year() {
        let app = build_app();
        let request = Request::get("/postgres/coins/after/2008")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        let coins = json.as_array().unwrap();

        for coin in coins {
            assert!(coin["launched"].as_i64().unwrap() > 2008);
        }
    }

    #[tokio::test]
    async fn test_get_coins_after_year_no_results() {
        let app = build_app();
        let request = Request::get("/postgres/coins/after/2050")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        let coins = json.as_array().unwrap();
        assert_eq!(coins.len(), 0);
    }

    #[tokio::test]
    async fn test_create_new_coin() {
        let app = build_app();
        let ticker = random_ticker();
        let new_coin = serde_json::json!({
            "name": "TestCoin",
            "launched": 2025
        });
        let request = Request::put(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&new_coin).unwrap()))
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/postgres/coins/{}", ticker))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::OK);

        let body_bytes = get_response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["ticker"], ticker);
        assert_eq!(json["name"], "TestCoin");
        assert_eq!(json["launched"], 2025);
    }

    #[tokio::test]
    async fn test_create_new_coin_invalid_payload() {
        let app = build_app();
        let ticker = random_ticker();
        let invalid_payload = serde_json::json!({
            "invalid_field": "NoName",
            "launched": "NotAYear"
        });
        let request = Request::put(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&invalid_payload).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_delete_existing_coin() {
        let app = build_app();
        let ticker = random_ticker();
        let new_coin = serde_json::json!({
            "name": "DeleteCoin",
            "launched": 2025
        });
        let create_request = Request::put(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&new_coin).unwrap()))
            .unwrap();
        let create_response = app.clone().oneshot(create_request).await.unwrap();
        assert_eq!(create_response.status(), StatusCode::OK);

        let delete_request = Request::delete(format!("/postgres/coins/{}", ticker))
            .body(Body::empty())
            .unwrap();
        let delete_response = app.clone().oneshot(delete_request).await.unwrap();
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

        let get_request = Request::get(format!("/postgres/coins/{}", ticker))
            .body(Body::empty())
            .unwrap();
        let get_response = app.oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_delete_nonexistent_coin() {
        let app = build_app();
        let ticker = random_ticker();
        let delete_request = Request::delete(format!("/postgres/coins/{}", ticker))
            .body(Body::empty())
            .unwrap();
        let delete_response = app.oneshot(delete_request).await.unwrap();
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn test_update_existing_coin() {
        let app = build_app();
        let ticker = random_ticker();
        let new_coin = serde_json::json!({
            "name": "UpdateCoin",
            "launched": 2025
        });
        let update_coin = serde_json::json!({
            "name": "UpdateCoin123",
            "launched": 2025
        });
        let create_request = Request::put(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&new_coin).unwrap()))
            .unwrap();
        let create_response = app.clone().oneshot(create_request).await.unwrap();
        assert_eq!(create_response.status(), StatusCode::OK);

        let update_request = Request::patch(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_coin).unwrap()))
            .unwrap();
        let update_response = app.clone().oneshot(update_request).await.unwrap();
        assert_eq!(update_response.status(), StatusCode::OK);

        let body_bytes = update_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["ticker"], ticker);
        assert_eq!(json["name"], "UpdateCoin123");
    }

    #[tokio::test]
    async fn test_update_nonexistent_coin() {
        let app = build_app();
        let ticker = random_ticker();
        let update_coin = serde_json::json!({
            "name": "NonExistentCoin",
            "launched": 2025
        });
        let update_request = Request::patch(format!("/postgres/coins/{}", ticker))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_coin).unwrap()))
            .unwrap();
        let update_response = app.oneshot(update_request).await.unwrap();
        assert_eq!(update_response.status(), StatusCode::NOT_FOUND);
    }

    fn random_ticker() -> String {
        Uuid::new_v4().to_string()[..6].to_string().to_uppercase()
    }
}
