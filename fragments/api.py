import uvicorn
from fragments.env_vars.env_vars_utils import get_env_var
from fragments.apis.fastapi.app import build_app

if __name__ == "__main__":
    app = build_app()
    host = get_env_var("FASTAPI_HOST") or "localhost"
    uvicorn.run(app, host=host, port=3003, log_level="debug")
