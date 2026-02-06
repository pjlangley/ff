use crate::redis_db::redis_crud::{
    redis_create, redis_delete, redis_ping, redis_read, redis_update,
};
use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use serde_json;

#[derive(Debug, Deserialize)]
struct FavouriteCoin {
    favourite_coin: String,
}

pub fn redis_routes() -> Router {
    Router::new().route("/ping", get(ping)).route(
        "/favourites/{namespace}",
        get(get_favourites)
            .put(create_favourite_coin)
            .patch(update_favourite_coin)
            .delete(delete_favourites),
    )
}

async fn ping() -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(redis_ping).await;
    match result {
        Ok(Ok(pong)) => {
            (StatusCode::OK, Json(serde_json::json!({ "message": pong }))).into_response()
        }
        Ok(Err(e)) => handle_redis_error(e, "Failed to ping Redis"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn create_favourite_coin(
    Path(namespace): Path<String>,
    Json(payload): Json<FavouriteCoin>,
) -> impl IntoResponse {
    let result =
        tokio::task::spawn_blocking(move || redis_create(&namespace, &payload.favourite_coin))
            .await;

    match result {
        Ok(Ok(_)) => StatusCode::OK.into_response(),
        Ok(Err(e)) => handle_redis_error(e, "Failed to create favourite coin"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn get_favourites(Path(namespace): Path<String>) -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(move || redis_read(&namespace)).await;
    match result {
        Ok(Ok(data)) => {
            if data.is_empty() {
                return (StatusCode::NOT_FOUND,).into_response();
            }

            (StatusCode::OK, Json(data)).into_response()
        }
        Ok(Err(e)) => handle_redis_error(e, "Failed to get favourites"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn update_favourite_coin(
    Path(namespace): Path<String>,
    Json(payload): Json<FavouriteCoin>,
) -> impl IntoResponse {
    let result =
        tokio::task::spawn_blocking(move || redis_update(&namespace, &payload.favourite_coin))
            .await;

    match result {
        Ok(Ok(_)) => StatusCode::OK.into_response(),
        Ok(Err(e)) => handle_redis_error(e, "Failed to update favourite coin"),
        Err(join_err) => handle_join_error(join_err),
    }
}

async fn delete_favourites(Path(namespace): Path<String>) -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(move || redis_delete(&namespace)).await;
    match result {
        Ok(Ok(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => handle_redis_error(e, "Failed to delete favourites"),
        Err(join_err) => handle_join_error(join_err),
    }
}

fn handle_redis_error(redis_err: redis::RedisError, message: &str) -> Response {
    eprintln!("Redis error: {redis_err}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": message })),
    )
        .into_response()
}

fn handle_join_error(join_err: tokio::task::JoinError) -> Response {
    eprintln!("Task join error: {join_err}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": "internal failure" })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apis::axum::app::build_app;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_ping_redis() {
        let app = build_app();
        let request = Request::get("/redis/ping").body(Body::empty()).unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["message"], "PONG");
    }

    #[tokio::test]
    async fn test_get_favourites() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let payload = serde_json::json!({ "favourite_coin": "BTC" });
        let request = Request::put(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&payload).unwrap()))
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["favourite_coin"], "BTC");
    }

    #[tokio::test]
    async fn test_get_favourites_empty_namespace() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let request = Request::get(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_update_favourite_coin() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let payload = serde_json::json!({ "favourite_coin": "Solana" });
        let update_payload = serde_json::json!({ "favourite_coin": "Bitcoin" });

        let create_request = Request::put(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&payload).unwrap()))
            .unwrap();
        let response = app.clone().oneshot(create_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let update_request = Request::patch(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
            .unwrap();
        let response = app.clone().oneshot(update_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let get_request = Request::get(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["favourite_coin"], "Bitcoin");
    }

    #[tokio::test]
    async fn test_update_favourite_coin_nonexistent_namespace() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let update_payload = serde_json::json!({ "favourite_coin": "Bitcoin" });
        let update_request = Request::patch(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
            .unwrap();
        let response = app.oneshot(update_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_update_favourite_coin_bad_payload() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let bad_payload = serde_json::json!({ "invalidField": "Ethereum" });
        let request = Request::patch(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&bad_payload).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_create_favourite_coin_bad_payload() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let bad_payload = serde_json::json!({ "invalidField": "Bitcoin" });
        let request = Request::put(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&bad_payload).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_delete_favourites() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let payload = serde_json::json!({ "favourite_coin": "Bitcoin" });
        let create_request = Request::put(format!("/redis/favourites/{}", namespace))
            .header("Content-Type", "application/json")
            .body(Body::from(serde_json::to_vec(&payload).unwrap()))
            .unwrap();
        let response = app.clone().oneshot(create_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let request = Request::delete(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let get_request = Request::get(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let get_response = app.clone().oneshot(get_request).await.unwrap();
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_delete_favourites_nonexistent_namespace() {
        let app = build_app();
        let namespace = Uuid::new_v4().to_string();
        let request = Request::delete(format!("/redis/favourites/{}", namespace))
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
