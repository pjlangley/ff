from fragments.env_vars import get_env_var
from fragments.sqlite_db import (
    get_item_by_ticker,
    get_items_after_launch_year,
    get_all_items,
    add_item,
)
from fragments.redis_db import (
    redis_ping,
    redis_create,
    redis_read,
    redis_update,
    redis_delete,
)

# env vars
print(f"fragment 'env_vars' output: {get_env_var("REPO_NAME")}")

# sqlite
print(f"fragment 'sqlite_db/get_item_by_ticker' output: {get_item_by_ticker("BTC")}")
print(
    f"fragment 'sqlite_db/get_items_after_launch_year' output: {get_items_after_launch_year(2010)}"
)
print(f"fragment 'sqlite_db/get_all_items' output: {get_all_items()}")
print(f"fragment 'sqlite_db/add_item' output: {add_item(("PEPE", "Pepe", 2023))}")

# redis
print(f"fragment 'redis_db/redis_ping' output: {redis_ping()}")
print(f"fragment 'redis_db/redis_create' output: {redis_create("python", "bitcoin")}")
print(f"fragment 'redis_db/redis_read' output: {redis_read("python")}")
print(f"fragment 'redis_db/redis_update' output: {redis_update("python", "pepe")}")
print(f"fragment 'redis_db/redis_delete' output: {redis_delete("python")}")
