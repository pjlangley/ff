import time
from solana.rpc.api import Client, Commitment
from fragments.env_vars import get_env_var


def init_rpc_client() -> Client:
    url = "http://127.0.0.1:8899"

    if get_env_var("CI") is not None:
        url = url.replace("127.0.0.1", "solana-validator")

    client = Client(url, Commitment("confirmed"))

    return client


def wait_for_slot(slot: int, timeout: float = 5.0) -> bool:
    client = init_rpc_client()
    deadline = time.time() + timeout

    while time.time() < deadline:
        current_slot = client.get_slot().value
        if current_slot >= slot:
            return True
        time.sleep(0.2)

    return False
