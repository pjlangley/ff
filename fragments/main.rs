mod env_vars;
mod redis_db;
mod sqlite_db;

fn main() {
    // env vars
    println!(
        "fragment 'env_vars' output: {}",
        env_vars::env_vars_utils::get_env_var("REPO_NAME")
    );

    // sqlite
    println!(
        "fragment 'sqlite_db/get_item_by_ticker' output: {:?}",
        sqlite_db::sqlite_crud::get_item_by_ticker("BTC")
            .unwrap_or_else(|e| panic!("Expected item by ticker result but got error: {:?}", e))
    );

    let sqlite_db_items_after_launch_year =
        sqlite_db::sqlite_crud::get_items_after_launch_year(2010)
            .unwrap_or_else(|e| panic!("Expected coins after launch year but got error: {:?}", e));
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - found {} items",
        sqlite_db_items_after_launch_year.len()
    );
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - item 1: {}",
        sqlite_db_items_after_launch_year[0]
    );
    println!(
        "fragment 'sqlite_db/get_items_after_launch_year' - item 2: {}",
        sqlite_db_items_after_launch_year[1]
    );

    println!(
        "fragment 'sqlite_dbql/get_all_items' - found {} items",
        sqlite_db::sqlite_crud::get_all_items()
            .unwrap_or_else(|e| panic!("Expected coins but got error: {:?}", e))
            .len()
    );

    println!(
        "fragment 'sqlite_db/add_item' output: {:?}",
        sqlite_db::sqlite_crud::add_item("PEPE", "Pepe", 2023)
            .unwrap_or_else(|e| panic!("Expected to add item but got error: {:?}", e))
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
