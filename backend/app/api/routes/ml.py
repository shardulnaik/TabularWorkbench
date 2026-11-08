from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.db.session import get_db
from app.schemas.ml import ModelCompareRequest, ModelEvaluateRequest
from app.services.ml_service import compare_dataset_models, evaluate_selected_model, get_model_run, get_comparison

router = APIRouter(prefix="/datasets/{dataset_id}/ml", tags=["machine learning"])


@router.post("/compare")
def compare_models(request: ModelCompareRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return compare_dataset_models(db, dataset, request)


@router.post("/evaluate")
def evaluate_model(request: ModelEvaluateRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return evaluate_selected_model(db, dataset, request)


@router.get("/runs/{run_id}")
def model_run(run_id: str, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return get_model_run(db, dataset.id, run_id)


@router.get("/runs/{run_id}/comparison")
def model_comparison(run_id: str, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return get_comparison(db, dataset.id, run_id)
