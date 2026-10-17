from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings

_connect_args: dict = {}
_engine_options: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    if settings.database_url.endswith(":memory:") or settings.database_url.endswith("/:memory:"):
        _engine_options["poolclass"] = StaticPool

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_engine_options,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
