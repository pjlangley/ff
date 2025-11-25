use crate::api::axum::blockchain::solana_balance::solana_balance_routes;
use crate::api::axum::blockchain::solana_counter::solana_counter_routes;
use crate::api::axum::blockchain::solana_round::solana_round_routes;
use crate::api::axum::blockchain::solana_username::solana_username_routes;
use crate::api::axum::datastore::postgres_routes::postgres_routes;
use crate::api::axum::datastore::redis_routes::redis_routes;
use crate::api::axum::datastore::sqlite_routes::sqlite_routes;
use axum::Router;

pub fn build_app() -> Router {
    Router::new()
        .nest("/postgres", postgres_routes())
        .nest("/redis", redis_routes())
        .nest("/sqlite", sqlite_routes())
        .nest("/solana", solana_round_routes())
        .nest("/solana", solana_counter_routes())
        .nest("/solana", solana_username_routes())
        .nest("/solana", solana_balance_routes())
}
