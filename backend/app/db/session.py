from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings

_database_url = make_url(settings.database_url)
_connect_args: dict[str, object] = {}
_engine_options: dict[str, object] = {"pool_pre_ping": True}
if _database_url.get_backend_name() == "sqlite":
    _connect_args["check_same_thread"] = False
    if _database_url.database in {None, "", ":memory:"}:
        _engine_options["poolclass"] = StaticPool
else:
    _engine_options.update(
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )

engine = create_engine(
    _database_url,
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
