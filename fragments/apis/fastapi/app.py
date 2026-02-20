from fastapi import FastAPI
from fragments.apis.fastapi.datastore.postgres import postgres_router
from fragments.apis.fastapi.datastore.redis import redis_router
from fragments.apis.fastapi.datastore.sqlite import sqlite_router
from fragments.apis.fastapi.blockchain.solana_counter import solana_counter_router


def build_app() -> FastAPI:
    app = FastAPI()

    app.include_router(postgres_router, prefix="/postgres")
    app.include_router(redis_router, prefix="/redis")
    app.include_router(sqlite_router, prefix="/sqlite")
    app.include_router(solana_counter_router, prefix="/solana/counter")

    return app
