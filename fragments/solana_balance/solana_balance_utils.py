from solders.pubkey import Pubkey
from fragments.solana_rpc import init_rpc_client


def get_balance(address: Pubkey) -> int:
    client = init_rpc_client()
    return client.get_balance(address).value
