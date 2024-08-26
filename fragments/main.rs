mod env_vars;
mod sql;

fn main() {
    println!(
        "fragment 'env_vars' output: {}",
        env_vars::env_vars_utils::get_env_var("REPO_NAME")
    );

    println!(
        "fragment 'sql/get_item_by_ticker' output: {}",
        sql::sql_queries::get_item_by_ticker("BTC").unwrap()
    );

    let items_after_launch_year = sql::sql_queries::get_items_after_launch_year(2010).unwrap();
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

    let all_items = sql::sql_queries::get_all_items().unwrap();
    println!(
        "fragment 'sql/get_all_items' - found {} items",
        all_items.len()
    );

    println!(
        "fragment 'sql/add_item' output: {:?}",
        sql::sql_queries::add_item("PEPE", "Pepe", 2023)
    );
}
