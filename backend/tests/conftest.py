from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
TEST_STORAGE = BACKEND_ROOT / "tests" / ".test_runtime"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ARTIFACT_STORAGE_DIR"] = str(TEST_STORAGE)
os.environ["CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"

import pytest
from fastapi.testclient import TestClient
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_test_state():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    if TEST_STORAGE.exists():
        for child in TEST_STORAGE.iterdir():
            if child.is_dir(): shutil.rmtree(child, ignore_errors=True)
            else: child.unlink(missing_ok=True)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
