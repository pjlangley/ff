from typing import TypedDict
from fastapi import APIRouter

postgres_router = APIRouter()


class PingResponse(TypedDict):
    message: str


@postgres_router.get("/ping", response_model=PingResponse, status_code=200)
async def ping() -> PingResponse:
    return PingResponse(message="pong")
