from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.db.session import get_db
from app.schemas.cleaning import CleaningApplyRequest
from app.services.cleaning_service import apply_cleaning_actions, build_cleaning_plan, get_cleaning_log
from app.services.dataset_service import load_session_dataframe

router = APIRouter(prefix="/datasets/{dataset_id}/cleaning", tags=["cleaning"])


@router.get("/plan")
def cleaning_plan(dataset: DatasetSession = Depends(get_dataset)) -> dict:
    return build_cleaning_plan(load_session_dataframe(dataset))


@router.post("/apply")
def apply_cleaning(request: CleaningApplyRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    try:
        return apply_cleaning_actions(db, dataset, request.actions)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/log")
def cleaning_log(dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return {"items": get_cleaning_log(db, dataset.id)}
