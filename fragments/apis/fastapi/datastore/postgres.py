from typing import TypedDict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from fragments.postgres_db.postgres_crud import (
    get_all_items,
    get_item_by_ticker,
    get_items_after_launch_year,
    add_item,
    remove_item,
    update_item,
)

postgres_router = APIRouter()


class CryptoCoin(TypedDict):
    id: int
    ticker: str
    name: str
    launched: int


class CoinBody(BaseModel):
    name: str
    launched: int


def tuple_to_coin(coin_tuple: tuple) -> CryptoCoin:
    return CryptoCoin(
        id=coin_tuple[0],
        ticker=coin_tuple[1],
        name=coin_tuple[2],
        launched=coin_tuple[3],
    )


@postgres_router.get("/coins", status_code=200)
async def get_coins() -> List[CryptoCoin]:
    items = get_all_items()
    return [tuple_to_coin(item) for item in items]


@postgres_router.get("/coins/after/{year}", status_code=200)
async def get_coins_after_year(year: int) -> List[CryptoCoin]:
    items = get_items_after_launch_year(year)
    return [tuple_to_coin(item) for item in items]


@postgres_router.get("/coins/{ticker}", status_code=200)
async def get_coin_by_ticker_route(ticker: str) -> CryptoCoin:
    item = get_item_by_ticker(ticker.upper())
    if item is None:
        raise HTTPException(status_code=404)
    return tuple_to_coin(item)


@postgres_router.put("/coins/{ticker}", status_code=200)
async def add_coin(ticker: str, body: CoinBody):
    add_item((ticker.upper(), body.name, body.launched))
    return None


@postgres_router.delete("/coins/{ticker}", status_code=204)
async def delete_coin(ticker: str):
    remove_item(ticker.upper())
    return None


@postgres_router.patch("/coins/{ticker}", status_code=200)
async def update_coin_route(ticker: str, body: CoinBody) -> CryptoCoin:
    result = update_item((ticker.upper(), body.name, body.launched))
    if result is None:
        raise HTTPException(status_code=404)
    return tuple_to_coin(result)
