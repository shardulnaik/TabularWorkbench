from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import DatasetSession
from app.storage.local_artifacts import artifact_store


def ensure_dataset_available(db: Session, dataset_id: str) -> DatasetSession:
    dataset = db.get(DatasetSession, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or has expired.")
    expiry = dataset.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= datetime.now(timezone.utc):
        db.delete(dataset)
        db.commit()
        artifact_store.remove_dataset(dataset_id)
        raise HTTPException(status_code=410, detail="This dataset session has expired. Upload the file again.")
    if not Path(dataset.cleaned_dataframe_path).is_file():
        raise HTTPException(status_code=410, detail="Temporary dataset files are no longer available. Upload the file again.")
    return dataset


def cleanup_expired_sessions(db: Session) -> int:
    now = datetime.now(timezone.utc)
    expired = db.query(DatasetSession).all()
    removed = 0
    for dataset in expired:
        expires = dataset.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= now:
            artifact_store.remove_dataset(dataset.id)
            db.delete(dataset)
            removed += 1
    if removed:
        db.commit()
    return removed
