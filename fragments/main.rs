mod env_vars;
mod redis_db;
mod sql;

fn main() {
    // env vars
    println!(
        "fragment 'env_vars' output: {}",
        env_vars::env_vars_utils::get_env_var("REPO_NAME")
    );

    // sql
    println!(
        "fragment 'sql/get_item_by_ticker' output: {}",
        sql::sql_queries::get_item_by_ticker("BTC")
            .unwrap_or_else(|| panic!("Expected BTC coin but got None"))
    );

    let items_after_launch_year = sql::sql_queries::get_items_after_launch_year(2010)
        .unwrap_or_else(|| panic!("Expected results but got None"));
    println!(
        "fragment 'sql/get_items_after_launch_year' - found {} items",
        items_after_launch_year.len()
    );
    println!(
        "fragment 'sql/get_items_after_launch_year' - item 1: {}",
        items_after_launch_year[0]
    );
    println!(
        "fragment 'sql/get_items_after_launch_year' - item 2: {}",
        items_after_launch_year[1]
    );

    let all_items =
        sql::sql_queries::get_all_items().unwrap_or_else(|| panic!("Expected coins but got None"));
    println!(
        "fragment 'sql/get_all_items' - found {} items",
        all_items.len()
    );

    println!(
        "fragment 'sql/add_item' output: {:?}",
        sql::sql_queries::add_item("PEPE", "Pepe", 2023)
    );

    // redis
    println!(
        "fragment 'redis_db/ping' output: {:?}",
        redis_db::redis_crud::redis_ping()
    );
    println!(
        "fragment 'redis_db/create' output: {:?}",
        redis_db::redis_crud::redis_create("rust", "bitcoin")
    );
    println!(
        "fragment 'redis_db/read' output: {:?}",
        redis_db::redis_crud::redis_read("rust")
    );
    println!(
        "fragment 'redis_db/update' output: {:?}",
        redis_db::redis_crud::redis_update("rust", "pepe")
    );
    println!(
        "fragment 'redis_db/delete' output: {:?}",
        redis_db::redis_crud::redis_delete("rust")
    );
}
