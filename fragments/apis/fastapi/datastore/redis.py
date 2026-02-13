from typing import TypedDict
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from fragments.redis_db.redis_crud import (
    redis_ping,
    redis_create,
    redis_read,
    redis_update,
    redis_delete,
)

redis_router = APIRouter()


class PingResponse(TypedDict):
    message: str


class FavouriteResponse(TypedDict):
    favourite_coin: str


class FavouriteBody(BaseModel):
    favourite_coin: str


@redis_router.get("/ping", status_code=200)
async def ping() -> PingResponse:
    result = redis_ping()
    return PingResponse(message=result)


@redis_router.get("/favourites/{namespace}", status_code=200)
async def get_favourite(namespace: str) -> FavouriteResponse:
    item = redis_read(namespace)
    if "favourite_coin" not in item:
        raise HTTPException(status_code=404)
    return FavouriteResponse(favourite_coin=item["favourite_coin"])


@redis_router.put("/favourites/{namespace}", status_code=200)
async def create_favourite(namespace: str, body: FavouriteBody):
    redis_create(namespace, body.favourite_coin)
    return None


@redis_router.patch("/favourites/{namespace}", status_code=200)
async def update_favourite(namespace: str, body: FavouriteBody):
    redis_update(namespace, body.favourite_coin)
    return None


@redis_router.delete("/favourites/{namespace}", status_code=204)
async def delete_favourite(namespace: str):
    redis_delete(namespace)
    return Response(status_code=204)
