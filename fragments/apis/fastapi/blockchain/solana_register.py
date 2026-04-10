import logging
from functools import lru_cache
from fastapi import APIRouter, HTTPException
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.constants import LAMPORTS_PER_SOL
from solana.rpc.core import RPCException

from fragments.solana_program_register import (
    initialise_registry,
    register,
    confirm_registration,
    get_registry_state_account,
    get_registration_account,
)
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.env_vars import get_env_var

solana_register_router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory storage for registrant keypairs
# In production, use a secure key management service or encrypted database
keypair_storage: dict[str, Keypair] = {}


def load_keypair_from_file(path: str) -> Keypair:
    with open(path, encoding="utf-8") as f:
        return Keypair.from_json(f.read())


@lru_cache(maxsize=1)
def get_authority() -> Keypair:
    keypair_path = get_env_var("SOLANA_KEYPAIR_PATH") or "./solana_program_keys/solana_deployer.json"
    return load_keypair_from_file(keypair_path)


def get_program_address() -> Pubkey:
    program_id = get_env_var("register_PROGRAM_ID")
    if program_id is None:
        raise ValueError("environment variable register_PROGRAM_ID is not set")
    return Pubkey.from_string(program_id)


@solana_register_router.post("/initialise", status_code=200)
async def initialise_registry_route():
    try:
        program_address = get_program_address()
        authority = get_authority()
        await send_and_confirm_airdrop(authority.pubkey(), LAMPORTS_PER_SOL)

        try:
            signature = await initialise_registry(authority, program_address)
            await confirm_recent_signature(signature)
        except RPCException as e:
            if "already in use" not in str(e):
                raise
            logger.info("Registry already initialised, skipping initialisation step")

        return {"authority": str(authority.pubkey())}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error initialising registry: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_register_router.post("/register", status_code=200)
async def register_route():
    try:
        program_address = get_program_address()
        signer = Keypair()
        signer_address = str(signer.pubkey())
        await send_and_confirm_airdrop(signer.pubkey(), LAMPORTS_PER_SOL)
        keypair_storage[signer_address] = signer
        logger.info("Keypair stored for registrant: %s", signer_address)

        signature = await register(signer, program_address)
        confirmed = await confirm_recent_signature(signature)

        if not confirmed:
            raise HTTPException(
                status_code=500,
                detail="Transaction sent but confirmation timed out",
            )

        return {"address": signer_address}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error registering: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_register_router.get("/registry", status_code=200)
async def get_registry_state_route():
    try:
        program_address = get_program_address()
        account = await get_registry_state_account(program_address)

        return {
            "authority": str(account["authority"]),
            "registration_count": str(account["registration_count"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching registry state: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_register_router.get("/{address}", status_code=200)
async def get_registration_route(address: str):
    try:
        keypair = keypair_storage.get(address)
        if keypair is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()
        account = await get_registration_account(keypair.pubkey(), program_address)

        return {
            "registrant": str(account["registrant"]),
            "registration_index": str(account["registration_index"]),
            "registered_at": str(account["registered_at"]),
            "confirmed_at": str(account["confirmed_at"]) if account["confirmed_at"] is not None else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching registration account: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@solana_register_router.patch("/{address}/confirm", status_code=200)
async def confirm_registration_route(address: str):
    try:
        registrant = keypair_storage.get(address)
        if registrant is None:
            raise HTTPException(status_code=404)

        program_address = get_program_address()
        authority = get_authority()
        await send_and_confirm_airdrop(authority.pubkey(), LAMPORTS_PER_SOL)

        signature = await confirm_registration(authority, program_address, registrant.pubkey())
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
        logger.error("Error confirming registration: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e
