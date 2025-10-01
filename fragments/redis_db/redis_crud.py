from typing import Literal
import redis

from fragments.env_vars import get_env_var


def init_client() -> redis.Redis:
    host = get_env_var("REDIS_HOST")
    if host is None:
        return redis.Redis(decode_responses=True)

    return redis.from_url(f"redis://{host}:6379", decode_responses=True)


def redis_ping() -> bool:
    r = init_client()
    pong = r.ping()
    r.quit()

    if isinstance(pong, bool):
        return pong

    return False


def redis_create(namespace: str, favourite_coin: str) -> Literal["OK"]:
    r = init_client()
    r.hset(name=namespace, key="favourite_coin", value=favourite_coin)
    r.quit()
    return "OK"


def redis_read(namespace: str) -> dict:
    r = init_client()
    item = r.hgetall(name=namespace)
    r.quit()

    if not isinstance(item, dict):
        return {}

    return item


def redis_update(namespace: str, favourite_coin: str) -> Literal["OK"]:
    r = init_client()
    r.hset(name=namespace, key="favourite_coin", value=favourite_coin)
    r.quit()
    return "OK"


def redis_delete(namespace: str) -> Literal["OK"]:
    r = init_client()
    r.delete(namespace)
    r.quit()
    return "OK"
