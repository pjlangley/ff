from solders.keypair import Keypair
from fragments.env_vars import get_env_var
from fragments.sqlite_db import (
    get_item_by_ticker,
    get_items_after_launch_year,
    get_all_items,
    add_item,
    update_item,
    delete_item,
)
from fragments.redis_db import (
    redis_ping,
    redis_create,
    redis_read,
    redis_update,
    redis_delete,
)
from fragments.postgres_db import (
    get_item_by_ticker as pg_get_item_by_ticker,
    get_items_after_launch_year as pg_get_items_after_launch_year,
    get_all_items as pg_get_all_items,
    add_item as pg_add_item,
    remove_item as pg_remove_item,
    update_item as pg_update_item,
)
from fragments.solana_balance import get_balance
from fragments.solana_airdrop import airdrop
from fragments.solana_rpc import init_rpc_client

# env vars
print(f"fragment 'env_vars' output: {get_env_var("REPO_NAME")}")

# sqlite
print(f"fragment 'sqlite_db/get_item_by_ticker' output: {get_item_by_ticker("BTC")}")
print(f"fragment 'sqlite_db/get_items_after_launch_year' output: {get_items_after_launch_year(2010)}")
print(f"fragment 'sqlite_db/get_all_items' output: {get_all_items()}")
print(f"fragment 'sqlite_db/add_item' output: {add_item(("PEPE", "Pepe", 2023))}")
print(f"fragment 'sqlite_db/update_item' output: {update_item(("BTC", "Bitcoin", 2009))}")
print(f"fragment 'sqlite_db/delete_item' output: {delete_item("ETH")}")

# redis
print(f"fragment 'redis_db/redis_ping' output: {redis_ping()}")
print(f"fragment 'redis_db/redis_create' output: {redis_create("python", "bitcoin")}")
print(f"fragment 'redis_db/redis_read' output: {redis_read("python")}")
print(f"fragment 'redis_db/redis_update' output: {redis_update("python", "pepe")}")
print(f"fragment 'redis_db/redis_delete' output: {redis_delete("python")}")

# postgres
print(f"fragment 'postgres_db/get_item_by_ticker' output: {pg_get_item_by_ticker("BTC")}")
print(f"fragment 'postgres_db/get_items_after_launch_year' output: {pg_get_items_after_launch_year(2010)}")
print(f"fragment 'postgres_db/get_all_items' output: {pg_get_all_items()}")
print(f"fragment 'postgres_db/add_item' output: {pg_add_item(("PEPE", "Pepe", 2023))}")
print(f"fragment 'postgres_db/update_item' output: {pg_update_item(("PEPE", "Pepe", 2023))}")
print(f"fragment 'postgres_db/remove_item' output: {pg_remove_item("PEPE")}")

solana_key_pair = Keypair()
solana_address = solana_key_pair.pubkey()

# solana balance
print(f"fragment 'solana_balance/get_balance' output: {get_balance(solana_address)}")

# solana airdrop
print(f"fragment 'solana_airdrop/airdrop' output: {airdrop(solana_address, 1_000_000)}")

# solana rpc utils
solanaRpcClient = init_rpc_client()
print(f"fragment 'solana_rpc/init_rpc_client get_version' output: {solanaRpcClient.get_version()}")
