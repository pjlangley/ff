import time
from solders.signature import Signature
from fragments.solana_rpc import init_rpc_client


def confirm_recent_signature(signature: Signature, timeout: float = 5.0) -> bool:
    client = init_rpc_client()
    deadline = time.time() + timeout

    while time.time() < deadline:
        response = client.get_signature_statuses([signature])
        status = response.value[0]

        if status is not None and status.confirmations is not None:
            return True

        time.sleep(0.2)

    return False
