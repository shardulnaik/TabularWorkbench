from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Environment-backed configuration. Secrets belong in backend/.env locally."""

    app_env: str = "development"
    app_name: str = "Tabular Workbench"
    database_url: str = "sqlite+pysqlite:///./tabular_workbench.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
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
