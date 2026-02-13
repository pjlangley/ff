from fastapi import FastAPI
from fragments.apis.fastapi.datastore.postgres import postgres_router
from fragments.apis.fastapi.datastore.redis import redis_router


def build_app() -> FastAPI:
    app = FastAPI()

    app.include_router(postgres_router, prefix="/postgres")
    app.include_router(redis_router, prefix="/redis")

    return app
