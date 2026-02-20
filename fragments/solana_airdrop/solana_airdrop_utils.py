from solders.pubkey import Pubkey
from fragments.solana_rpc import init_rpc_client
from fragments.solana_transaction import confirm_recent_signature


async def send_and_confirm_airdrop(address: Pubkey, amount: int) -> None:
    client = init_rpc_client()
    formatted_amount = f"{amount:,}"
    print(f"Airdropping {formatted_amount} lamports to {address}")

    sig = (await client.request_airdrop(address, amount)).value
    is_confirmed = await confirm_recent_signature(sig)

    if not is_confirmed:
        raise RuntimeError(f"Airdrop was not confirmed for {address} with signature {sig}")

    print(f"Airdrop confirmed for {address} with signature {sig}")
