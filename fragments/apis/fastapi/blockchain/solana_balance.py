import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from solders.pubkey import Pubkey

from fragments.solana_balance.solana_balance_utils import get_balance

solana_balance_router = APIRouter()
logger = logging.getLogger(__name__)


@solana_balance_router.get("/{address}", status_code=200)
async def get_solana_balance(address: str):
    try:
        pubkey = Pubkey.from_string(address)
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid Solana address"},
        )

    try:
        balance = await get_balance(pubkey)
        return {"balance": str(balance)}
    except Exception as e:
        logger.error("Error fetching balance: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error") from e
