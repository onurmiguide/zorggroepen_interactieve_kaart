"""Centrale configuratie, gelezen uit environment variables / optioneel .env."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]  # .../backend
REPO_ROOT = BASE_DIR.parent  # repo root


def _load_dotenv() -> None:
    """Minimale .env loader zonder externe dependency.

    Zet alleen waarden die nog niet in de echte environment staan.
    """
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()


DEFAULT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
]


class Settings:
    def __init__(self) -> None:
        self.jwt_secret: str = os.getenv("ADMIN_JWT_SECRET", "dev-only-insecure-secret-change-me")
        self.jwt_algorithm: str = "HS256"
        self.session_minutes: int = int(os.getenv("ADMIN_SESSION_MINUTES", "480"))
        self.cookie_name: str = "miguide_admin_session"
        # Cookie alleen 'secure' in productie; lokaal over http moet dat uit.
        self.cookie_secure: bool = os.getenv("ADMIN_COOKIE_SECURE", "false").lower() == "true"

        # Externe database (bijv. Render PostgreSQL) via DATABASE_URL; anders lokaal SQLite.
        self.database_url_env = os.getenv("DATABASE_URL", "").strip()

        db_path_env = os.getenv("ADMIN_DB_PATH", "").strip()
        if db_path_env:
            self.db_path = Path(db_path_env)
        else:
            self.db_path = BASE_DIR / "data" / "miguide_admin.db"
        if not self.database_url_env:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.zorggroepen_seed_path = REPO_ROOT / "zg-data" / "zorggroepen.json"
        self.postcode_overrides_seed_path = REPO_ROOT / "zg-data" / "postcode_overrides.json"

    @property
    def is_sqlite(self) -> bool:
        return not self.database_url_env

    @property
    def allowed_origins(self) -> list[str]:
        raw = os.getenv("ADMIN_ALLOWED_ORIGINS", "").strip()
        if not raw:
            return DEFAULT_ALLOWED_ORIGINS
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def allowed_origin_regex(self) -> str:
        """Regex voor toegestane origins (naast de vaste lijst).

        Standaard matcht dit elk Vercel-domein (productie én previews), zodat de
        publieke kaart op Vercel de publieke admin-API mag aanroepen zonder dat we
        het exacte domein hoeven te kennen. Overschrijfbaar via env.
        """
        return os.getenv(
            "ADMIN_ALLOWED_ORIGIN_REGEX",
            r"https://([a-z0-9-]+\.)*vercel\.app",
        ).strip()

    @property
    def database_url(self) -> str:
        if self.database_url_env:
            url = self.database_url_env
            # Render/Heroku geven 'postgres://...'; SQLAlchemy + psycopg3 wil 'postgresql+psycopg://'.
            if url.startswith("postgres://"):
                url = "postgresql+psycopg://" + url[len("postgres://"):]
            elif url.startswith("postgresql://"):
                url = "postgresql+psycopg://" + url[len("postgresql://"):]
            return url
        return f"sqlite:///{self.db_path.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
