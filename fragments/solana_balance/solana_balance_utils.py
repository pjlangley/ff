from solders.pubkey import Pubkey
from fragments.solana_rpc import init_rpc_client


async def get_balance(address: Pubkey) -> int:
    client = init_rpc_client()
    return (await client.get_balance(address)).value
