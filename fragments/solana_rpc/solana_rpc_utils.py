import asyncio
import time
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from fragments.env_vars import get_env_var


def init_rpc_client() -> AsyncClient:
    url = "http://127.0.0.1:8899"
    host = get_env_var("SOLANA_HOST")

    if host is not None:
        url = url.replace("127.0.0.1", host)

    client = AsyncClient(url, Commitment("confirmed"))

    return client


async def wait_for_slot(slot: int, timeout: float = 5.0) -> bool:
    client = init_rpc_client()
    deadline = time.time() + timeout

    while time.time() < deadline:
        current_slot = (await client.get_slot()).value
        if current_slot >= slot:
            return True
        await asyncio.sleep(0.2)

    return False
