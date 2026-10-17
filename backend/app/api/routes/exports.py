from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_dataset
from app.db.models import DatasetSession
from app.db.session import get_db
from app.services.export_service import build_export

router = APIRouter(prefix="/datasets/{dataset_id}/exports", tags=["exports"])


@router.get("/{export_type}")
def export_artifact(
    export_type: str,
    run_id: str | None = Query(default=None),
    chart_run_id: str | None = Query(default=None),
    dataset: DatasetSession = Depends(get_dataset),
    db: Session = Depends(get_db),
) -> Response:
    content, media_type, filename = build_export(db, dataset, export_type, run_id=run_id, chart_run_id=chart_run_id)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
