use crate::api::axum::datastore::postgres_routes::postgres_routes;
use axum::Router;

pub fn build_app() -> Router {
    Router::new().nest("/postgres", postgres_routes())
}
