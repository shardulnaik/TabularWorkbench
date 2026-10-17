from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import charts, cleaning, datasets, eda, exports, health, ml
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.db.base import Base
from app.db.models import ChartRun, CleaningLog, DatasetSession, ModelRun  # Ensure ORM metadata is registered.
from app.db.session import SessionLocal, engine
from app.services.session_service import cleanup_expired_sessions

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create missing tables for straightforward local setup. Keep Alembic available for
    # versioned schema changes as the application evolves.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        cleanup_expired_sessions(db)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Session cleanup failed during startup")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Guided tabular data profiling, cleaning, visualization, and classification workflow.",
    lifespan=lifespan,
)

origins = settings.cors_origin_list
if "*" in origins:
    logger.warning("Wildcard CORS origin configured; do not use this setting for credentialed applications.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred. Check the server logs; uploaded data values are not included in this response."})


app.include_router(health.router)
for router in (datasets.router, cleaning.router, eda.router, charts.router, ml.router, exports.router):
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {"name": settings.app_name, "status": "ok", "docs": "/docs", "health": "/health"}
