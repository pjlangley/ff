from solders.signature import Signature
from fragments.solana_rpc import init_rpc_client


def confirm_recent_signature(signature: Signature) -> bool:
    client = init_rpc_client()
    response = client.confirm_transaction(signature)
    status = response.value[0]

    return bool(status is not None and status.confirmations is not None)
