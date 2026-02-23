import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.constants import LAMPORTS_PER_SOL

from fragments.solana_program_username.solana_username_interface import (
    initialise_username,
    get_username_account,
    update_username,
    get_username_record_account,
)
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.env_vars import get_env_var

solana_username_router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory storage for keypairs
# In production, use a secure key management service or encrypted database
keypair_storage: dict[str, Keypair] = {}


class UsernameBody(BaseModel):
    username: str


def get_program_address() -> Pubkey:
    program_id = get_env_var("username_PROGRAM_ID")
    if program_id is None:
        raise ValueError("environment variable username_PROGRAM_ID is not set")
    return Pubkey.from_string(program_id)


@solana_username_router.post("/initialise", status_code=200)
async def initialise_username_route(body: UsernameBody):
    try:
        program_address = get_program_address()
        signer = Keypair()
        address = str(signer.pubkey())
        await send_and_confirm_airdrop(signer.pubkey(), LAMPORTS_PER_SOL)
        keypair_storage[address] = signer
        logger.info("Keypair stored for username account: %s", address)

        signature = await initialise_username(signer, program_address, body.username)
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
        logger.error("Error initialising username account: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_username_router.get("/{address}", status_code=200)
async def get_username(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()
        account = await get_username_account(keypair, program_address)

        return {
            "username": account["username"]["value"],
            "change_count": str(account["change_count"]),
            "username_recent_history": [u["value"] for u in account["username_recent_history"]],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching username account: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_username_router.patch("/{address}", status_code=200)
async def update_username_route(address: str, body: UsernameBody):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()

        signature = await update_username(keypair, program_address, body.username)
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
        logger.error("Error updating username: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_username_router.get("/{address}/record/{change_index}", status_code=200)
async def get_username_record(address: str, change_index: int):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()

        try:
            account = await get_username_record_account(keypair.pubkey(), program_address, change_index)
            return {
                "old_username": account["old_username"]["value"],
                "change_index": str(account["change_index"]),
                "authority": str(account["authority"]),
            }
        except ValueError as e:
            if "does not exist" in str(e):
                raise HTTPException(status_code=404) from e
            raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching username record: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e
