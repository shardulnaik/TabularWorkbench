from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import PurePath
from uuid import uuid4

import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import DatasetSession
from app.services.profiling_service import profile_dataframe
from app.services.cleaning_service import build_cleaning_plan
from app.storage.local_artifacts import artifact_store
from app.utils.file_validation import read_dataframe, safe_filename


def load_session_dataframe(dataset: DatasetSession, original: bool = False) -> pd.DataFrame:
    path = dataset.original_dataframe_path if original else dataset.cleaned_dataframe_path
    return artifact_store.load_dataframe(path)


def create_dataset_session(
    db: Session,
    filename: str,
    content: bytes,
    extension: str,
    sheet_name: str | None = None,
) -> tuple[DatasetSession, dict, dict]:
    df, sheets = read_dataframe(content, extension, sheet_name)
    dataset_id = str(uuid4())
    safe_name = safe_filename(filename)
    raw_path = artifact_store.save_bytes(dataset_id, f"original_upload{extension}", content)
    original_df_path = artifact_store.save_dataframe(dataset_id, "original_dataframe.pkl", df)
    cleaned_df_path = artifact_store.save_dataframe(dataset_id, "cleaned_dataframe.pkl", df.copy(deep=True))
    selected_sheet = (sheet_name or (sheets[0] if sheets else None)) if extension == ".xlsx" else None
    now = datetime.now(timezone.utc)
    dataset = DatasetSession(
        id=dataset_id,
        original_filename=safe_name,
        file_extension=extension,
        selected_sheet=selected_sheet,
        original_upload_path=str(raw_path),
        original_dataframe_path=str(original_df_path),
        cleaned_dataframe_path=str(cleaned_df_path),
        row_count=int(df.shape[0]),
        column_count=int(df.shape[1]),
        data_revision=0,
        cleaning_applied=False,
        created_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
    )
    try:
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
    except Exception:
        db.rollback()
        artifact_store.remove_dataset(dataset_id)
        raise
    return dataset, profile_dataframe(df), build_cleaning_plan(df)


def get_upload_sheet_names(content: bytes, extension: str) -> list[str]:
    _, sheets = read_dataframe(content, extension)
    return sheets
