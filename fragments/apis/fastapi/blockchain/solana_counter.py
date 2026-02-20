import logging
from fastapi import APIRouter, HTTPException
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.constants import LAMPORTS_PER_SOL

from fragments.solana_program_counter import initialize_account, get_count, increment_counter
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.env_vars import get_env_var

solana_counter_router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory storage for keypairs
# In production, use a secure key management service or encrypted database
keypair_storage: dict[str, Keypair] = {}


def get_program_address() -> Pubkey:
    program_id = get_env_var("counter_PROGRAM_ID")
    if program_id is None:
        raise ValueError("environment variable counter_PROGRAM_ID is not set")
    return Pubkey.from_string(program_id)


@solana_counter_router.get("/{address}", status_code=200)
async def get_counter(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()
        count = await get_count(keypair, program_address)
        return {"count": str(count)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching counter: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_counter_router.post("/initialise", status_code=200)
async def initialise_counter():
    try:
        program_address = get_program_address()
        signer = Keypair()
        address = str(signer.pubkey())
        await send_and_confirm_airdrop(signer.pubkey(), LAMPORTS_PER_SOL)
        keypair_storage[address] = signer
        logger.info("Keypair stored for future operations: %s", address)

        signature = await initialize_account(signer, program_address)
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        return {"address": address}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error initialising counter: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_counter_router.patch("/{address}/increment", status_code=200)
async def increment_counter_route(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()

        signature = await increment_counter(keypair, program_address)
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        new_count = await get_count(keypair, program_address)
        return {"new_count": str(new_count)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error incrementing counter: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e
