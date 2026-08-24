from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[1]
USER_DATA_DIR = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "calccabos"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DATABASE_PATH = USER_DATA_DIR / "calc.db"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
DEFAULT_SECRET_KEY = "calccabos-desktop-secret-key-2026-local-only"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


from typing import Optional

def _find_env_file() -> Optional[str]:
    """Procura o .env em vários lugares e funciona também no executável empacotado."""
    candidates = [
        PROJECT_ROOT / ".env",
        Path.cwd() / ".env",
        APP_DIR / ".env",
    ]

    if hasattr(sys, "_MEIPASS"):
        candidates.insert(0, Path(sys._MEIPASS) / ".env")
        candidates.insert(0, Path(sys.executable).resolve().parent / ".env")

    for candidate in candidates:
        try:
            if candidate.is_file():
                return str(candidate)
        except OSError:
            continue

    return None


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES))
    )

    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "tencent/hy3-preview:free"
    OPENROUTER_MODELS: str = "openrouter/free,nvidia/nemotron-3-super:free,openai/gpt-oss-120b:free"

    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODELS: str = "gemini-2.5-flash,gemini-2.0-flash"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODELS: str = "llama-3.1-8b-instant"

    class Config:
        env_file = _find_env_file() or ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def secret_key(self) -> str:
        return self.SECRET_KEY

    @property
    def access_token_expire_minutes(self) -> int:
        return self.ACCESS_TOKEN_EXPIRE_MINUTES

    @property
    def openrouter_api_key(self) -> Optional[str]:
        return self.OPENROUTER_API_KEY

    @property
    def openrouter_model(self) -> str:
        return self.OPENROUTER_MODEL

    @property
    def openrouter_models(self) -> str:
        return self.OPENROUTER_MODELS

    @property
    def gemini_api_key(self) -> Optional[str]:
        return self.GEMINI_API_KEY or self.GOOGLE_API_KEY

    @property
    def google_api_key(self) -> Optional[str]:
        return self.GOOGLE_API_KEY or self.GEMINI_API_KEY

    @property
    def gemini_models(self) -> str:
        return self.GEMINI_MODELS

    @property
    def groq_api_key(self) -> Optional[str]:
        return self.GROQ_API_KEY

    @property
    def groq_models(self) -> str:
        return self.GROQ_MODELS


settings = Settings()
