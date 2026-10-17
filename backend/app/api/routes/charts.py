from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.db.session import get_db
from app.schemas.charts import ChartRequest
from app.services.chart_service import create_chart_run
from app.services.dataset_service import load_session_dataframe

router = APIRouter(prefix="/datasets/{dataset_id}/charts", tags=["charts"])


@router.post("/data")
def chart_data(request: ChartRequest, dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    return create_chart_run(db, dataset, load_session_dataframe(dataset), request)


@router.get("")
def list_charts(dataset: DatasetSession = Depends(get_dataset), db: Session = Depends(get_db)) -> dict:
    from app.db.models import ChartRun
    rows = db.query(ChartRun).filter(ChartRun.dataset_id == dataset.id).order_by(ChartRun.created_at.desc()).limit(50).all()
    return {"items": [{"chart_run_id": row.id, "chart_type": row.chart_type, "config": row.config_json, "data_revision": row.data_revision, "created_at": row.created_at.isoformat()} for row in rows]}
