from solana.rpc.api import Client, Commitment
from fragments.env_vars import get_env_var


def init_rpc_client() -> Client:
    url = "http://127.0.0.1:8899"

    if get_env_var("CI") is not None:
        url = url.replace("127.0.0.1", "solana-validator")

    client = Client(url, Commitment("confirmed"))

    return client
