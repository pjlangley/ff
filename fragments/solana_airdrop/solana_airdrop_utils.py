from solders.pubkey import Pubkey
from solders.signature import Signature
from fragments.solana_rpc import init_rpc_client


def airdrop(address: Pubkey, amount: int) -> Signature:
    client = init_rpc_client()
    formatted_amount = f"{amount:,}"
    print(f"Airdropping {formatted_amount} lamports to {address}")

    return client.request_airdrop(address, amount).value
