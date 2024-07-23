import os
from typing import Optional


def get_env_var(name: str) -> Optional[str]:
    return os.environ.get(name)
