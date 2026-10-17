from fastapi import APIRouter, Depends

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.services.dataset_service import load_session_dataframe
from app.services.eda_service import build_eda_summary

router = APIRouter(prefix="/datasets/{dataset_id}/eda", tags=["exploration"])


@router.get("/summary")
def eda_summary(dataset: DatasetSession = Depends(get_dataset)) -> dict:
    return build_eda_summary(load_session_dataframe(dataset))
