from pathlib import Path

import uvicorn
from dotenv import load_dotenv

from fragments.env_vars.env_vars_utils import get_env_var
from fragments.apis.fastapi.app import build_app

script_dir = Path(__file__).resolve().parent
load_dotenv(dotenv_path=script_dir / "../solana_program_keys/solana_program_keys.env")

if __name__ == "__main__":
    app = build_app()
    host = get_env_var("FASTAPI_HOST") or "localhost"
    uvicorn.run(app, host=host, port=3003, log_level="debug")
