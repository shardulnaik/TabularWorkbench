from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import DatasetSession
from app.db.session import get_db
from app.services.session_service import ensure_dataset_available


def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> DatasetSession:
    return ensure_dataset_available(db, dataset_id)


def not_found(detail: str = "The requested resource was not found") -> HTTPException:
    return HTTPException(status_code=404, detail=detail)
