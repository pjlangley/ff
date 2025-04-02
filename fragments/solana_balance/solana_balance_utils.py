from solana.rpc.api import Client
from solders.pubkey import Pubkey
from fragments.env_vars import get_env_var


def get_balance(address: Pubkey):
    url = "http://127.0.0.1:8899"

    if get_env_var("CI") is not None:
        url = url.replace("127.0.0.1", "solana-validator")

    client = Client(url)

    return client.get_balance(address).value
