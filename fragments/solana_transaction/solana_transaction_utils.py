import asyncio
import time
from solders.signature import Signature
from solders.keypair import Keypair
from solders.instruction import Instruction
from solders.message import MessageV0
from solders.transaction import VersionedTransaction
from fragments.solana_rpc import init_rpc_client


async def confirm_recent_signature(signature: Signature, timeout: float = 5.0) -> bool:
    client = init_rpc_client()
    deadline = time.time() + timeout

    while time.time() < deadline:
        response = await client.get_signature_statuses([signature])
        status = response.value[0]

        if status is not None and status.confirmations is not None:
            return True

        await asyncio.sleep(0.2)

    return False


async def create_tx_with_fee_payer_and_lifetime(
    user_keypair: Keypair, instruction: Instruction
) -> VersionedTransaction:
    client = init_rpc_client()
    latest_blockhash = (await client.get_latest_blockhash()).value.blockhash

    msg = MessageV0.try_compile(
        payer=user_keypair.pubkey(),
        recent_blockhash=latest_blockhash,
        instructions=[instruction],
        address_lookup_table_accounts=[],
    )

    return VersionedTransaction(msg, [user_keypair])
