from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.db.session import get_db
from app.schemas.ml import ModelTrainRequest, SinglePredictionRequest
from app.services.ml_service import get_model_run, predict_one, train_for_target

router = APIRouter(prefix="/datasets/{dataset_id}/ml", tags=["machine learning"])


@router.post("/train")
def train_model(request: ModelTrainRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return train_for_target(db, dataset, request)


@router.post("/predict")
def predict_record(request: SinglePredictionRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return predict_one(db, dataset, request)


@router.get("/runs/{run_id}")
def model_run(run_id: str, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return get_model_run(db, dataset.id, run_id)
