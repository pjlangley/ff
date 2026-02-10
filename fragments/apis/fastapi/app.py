from fastapi import FastAPI
from fragments.apis.fastapi.datastore.postgres import postgres_router


def build_app() -> FastAPI:
    app = FastAPI()

    app.include_router(postgres_router, prefix="/postgres")

    return app
