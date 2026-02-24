import logging
from fastapi import APIRouter, HTTPException
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.constants import LAMPORTS_PER_SOL

from fragments.solana_program_round import initialise_round, get_round_account, activate_round, complete_round
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.solana_rpc import init_rpc_client
from fragments.env_vars import get_env_var

solana_round_router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory storage for keypairs
# In production, use a secure key management service or encrypted database
keypair_storage: dict[str, Keypair] = {}


def get_program_address() -> Pubkey:
    program_id = get_env_var("round_PROGRAM_ID")
    if program_id is None:
        raise ValueError("environment variable round_PROGRAM_ID is not set")
    return Pubkey.from_string(program_id)


@solana_round_router.post("/initialise", status_code=200)
async def initialise_round_route():
    try:
        program_address = get_program_address()
        signer = Keypair()
        address = str(signer.pubkey())
        await send_and_confirm_airdrop(signer.pubkey(), LAMPORTS_PER_SOL)
        keypair_storage[address] = signer
        logger.info("Keypair stored for round authority: %s", address)

        client = init_rpc_client()
        recent_slot = (await client.get_slot()).value
        start_slot = recent_slot + 3

        signature = await initialise_round(signer, program_address, start_slot)
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        return {"address": address, "start_slot": str(start_slot)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error initialising round: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_round_router.get("/{address}", status_code=200)
async def get_round(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()
        account = await get_round_account(keypair.pubkey(), program_address)

        return {
            "start_slot": str(account["start_slot"]),
            "authority": str(account["authority"]),
            "activated_at": str(account["activated_at"]) if account["activated_at"] is not None else None,
            "activated_by": str(account["activated_by"]) if account["activated_by"] is not None else None,
            "completed_at": str(account["completed_at"]) if account["completed_at"] is not None else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching round account: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_round_router.patch("/{address}/activate", status_code=200)
async def activate_round_route(address: str):
    try:
        round_authority = keypair_storage.get(address)
        if round_authority is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()

        payer = Keypair()
        await send_and_confirm_airdrop(payer.pubkey(), LAMPORTS_PER_SOL)

        signature = await activate_round(payer, program_address, round_authority.pubkey())
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error activating round: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_round_router.patch("/{address}/complete", status_code=200)
async def complete_round_route(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()

        signature = await complete_round(keypair, program_address)
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error completing round: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e
