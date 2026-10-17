from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]


def normalize_database_url(database_url: str) -> str:
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
        return url.render_as_string(hide_password=False)
    return database_url


class Settings(BaseSettings):
    """Environment-backed configuration. Secrets belong in backend/.env locally."""

    app_env: str = "development"
    app_name: str = "Tabular Workbench"
    database_url: str
    cors_origins: str = "http://localhost:5173,https://tabular-workbench.vercel.app"
    max_upload_mb: int = 20
    session_ttl_hours: int = 6
    log_level: str = "INFO"
    artifact_storage_dir: str = "runtime"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("database_url")
    @classmethod
    def use_psycopg3_for_postgresql(cls, value: str) -> str:
        return normalize_database_url(value)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def artifact_root(self) -> Path:
        configured = Path(self.artifact_storage_dir).expanduser()
        if not configured.is_absolute():
            configured = BACKEND_DIR / configured
        return configured.resolve()

    @property
    def max_upload_bytes(self) -> int:
        return max(1, self.max_upload_mb) * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
