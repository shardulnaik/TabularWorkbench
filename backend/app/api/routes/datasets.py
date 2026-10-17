from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.core.config import settings
from app.db.models import DatasetSession
from app.db.session import get_db
from app.services.dataset_service import create_dataset_session, load_session_dataframe
from app.services.profiling_service import profile_dataframe
from app.services.cleaning_service import build_cleaning_plan
from app.utils.file_validation import read_dataframe, safe_filename, validate_file_bytes

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload")
async def upload_dataset(file: Annotated[UploadFile, File(description="CSV or XLSX, up to configured size limit")], sheet_name: Annotated[str | None, Form()] = None, db: Session = Depends(get_db)) -> dict:
    filename = safe_filename(file.filename)
    content = await file.read(settings.max_upload_bytes + 1)
    extension = validate_file_bytes(filename, content, settings.max_upload_bytes)
    if extension == ".xlsx":
        _, sheets = read_dataframe(content, extension, sheet_name)
        if len(sheets) > 1 and sheet_name is None:
            return {"requires_sheet_selection": True, "available_sheets": sheets, "message": "This workbook has multiple sheets. Choose the sheet you want to analyze and submit the file again."}
    dataset, profile, plan = create_dataset_session(db, filename, content, extension, sheet_name)
    return {"requires_sheet_selection": False, "session_id": dataset.id, "filename": dataset.original_filename, "selected_sheet": dataset.selected_sheet, "row_count": dataset.row_count, "column_count": dataset.column_count, "data_revision": dataset.data_revision, "expires_at": dataset.expires_at.isoformat(), "profile": profile, "cleaning_plan": plan, "message": "Dataset uploaded and profiled successfully."}


@router.get("/{dataset_id}")
def dataset_details(dataset: DatasetSession = Depends(get_dataset)) -> dict:
    df = load_session_dataframe(dataset)
    return {"session_id": dataset.id, "filename": dataset.original_filename, "selected_sheet": dataset.selected_sheet, "row_count": len(df), "column_count": len(df.columns), "data_revision": dataset.data_revision, "cleaning_applied": dataset.cleaning_applied, "expires_at": dataset.expires_at.isoformat()}


@router.get("/{dataset_id}/profile")
def dataset_profile(dataset: DatasetSession = Depends(get_dataset)) -> dict:
    return {"session_id": dataset.id, "data_revision": dataset.data_revision, "profile": profile_dataframe(load_session_dataframe(dataset))}
