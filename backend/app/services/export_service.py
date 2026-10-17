from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import ChartRun, DatasetSession, ModelRun
from app.services.cleaning_service import get_cleaning_log
from app.services.dataset_service import load_session_dataframe
from app.services.profiling_service import profile_dataframe
from app.storage.local_artifacts import artifact_store
from app.utils.serialization import json_safe


def dataframe_csv_bytes(df: pd.DataFrame, spreadsheet_safe: bool = True) -> bytes:
    export_df = df.copy()
    if spreadsheet_safe:
        # Protect spreadsheet users from formula injection on CSV open. The in-app dataframe remains unchanged.
        for column in export_df.select_dtypes(include=["object", "string"]).columns:
            export_df[column] = export_df[column].map(_safe_csv_cell)
    return export_df.to_csv(index=False).encode("utf-8-sig")


def _safe_csv_cell(value):
    if not isinstance(value, str):
        return value
    stripped = value.lstrip()
    if stripped.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


def chart_to_dataframe(chart_data: dict) -> pd.DataFrame:
    if chart_data.get("chart_type") == "correlation_heatmap":
        return pd.DataFrame(chart_data.get("data", []))
    return pd.DataFrame(chart_data.get("data", []))


def build_export(db: Session, dataset: DatasetSession, export_type: str, run_id: str | None = None, chart_run_id: str | None = None) -> tuple[bytes, str, str]:
    df = load_session_dataframe(dataset)
    if export_type == "cleaned-data":
        return dataframe_csv_bytes(df), "text/csv; charset=utf-8", f"{dataset.id}_cleaned_data.csv"
    if export_type == "data-profile":
        payload = profile_dataframe(df)
        return json.dumps(payload, ensure_ascii=False, indent=2).encode(), "application/json", f"{dataset.id}_data_profile.json"
    if export_type == "original-upload":
        original_path = Path(dataset.original_upload_path).resolve()
        if not original_path.is_file():
            raise HTTPException(status_code=410, detail="The original upload is no longer available.")
        media_type = "text/csv; charset=utf-8" if dataset.file_extension == ".csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return original_path.read_bytes(), media_type, f"{dataset.id}_original{dataset.file_extension}"
    if export_type == "cleaning-log":
        payload = get_cleaning_log(db, dataset.id)
        columns = ["id", "action_id", "title", "rows_affected", "details", "created_at"]
        return dataframe_csv_bytes(pd.DataFrame(payload, columns=columns)), "text/csv; charset=utf-8", f"{dataset.id}_cleaning_log.csv"
    if export_type == "chart-data":
        if not chart_run_id:
            raise HTTPException(status_code=422, detail="Provide chart_run_id to export chart data.")
        chart = db.get(ChartRun, chart_run_id)
        if chart is None or chart.dataset_id != dataset.id:
            raise HTTPException(status_code=404, detail="Chart run was not found for this dataset.")
        return dataframe_csv_bytes(chart_to_dataframe(chart.chart_data_json)), "text/csv; charset=utf-8", f"{chart.id}_chart_data.csv"
    if export_type.startswith("model-") or export_type in {"confusion-matrix", "predictions"}:
        run = _get_completed_model_run(db, dataset.id, run_id)
        result = run.evaluation_json or {}
        if export_type == "model-comparison":
            df_export = pd.DataFrame([{"model": m["model"], "label": m["label"], **{f"cv_{k}": v for k, v in (m.get("cv_metrics") or {}).items()}, "folds": m.get("folds")} for m in result.get("comparison", [])])
            return dataframe_csv_bytes(df_export), "text/csv; charset=utf-8", f"{run.id}_model_comparison.csv"
        if export_type == "model-metrics":
            payload = {"model_run_id": run.id, "selected_model": run.selected_model, "target_column": run.target_column, "metrics": result.get("metrics", {}), "classification_report": result.get("classification_report", {}), "configuration": result.get("model_configuration", {}), "interpretation": result.get("interpretation", "")}
            return json.dumps(json_safe(payload), ensure_ascii=False, indent=2).encode(), "application/json", f"{run.id}_model_metrics.json"
        if export_type == "confusion-matrix":
            matrix = result.get("confusion_matrix", {})
            labels, values = matrix.get("labels", []), matrix.get("matrix", [])
            data = pd.DataFrame(values, index=labels, columns=labels).rename_axis("actual")
            return data.to_csv().encode("utf-8-sig"), "text/csv; charset=utf-8", f"{run.id}_confusion_matrix.csv"
        if export_type == "predictions":
            if not run.predictions_path or not Path(run.predictions_path).is_file():
                raise HTTPException(status_code=410, detail="Prediction artifact is no longer available.")
            pred = pd.read_csv(run.predictions_path)
            return dataframe_csv_bytes(pred), "text/csv; charset=utf-8", f"{run.id}_predictions.csv"
        if export_type == "model-pipeline":
            if not run.artifact_path or not Path(run.artifact_path).is_file():
                raise HTTPException(status_code=410, detail="Model artifact is no longer available.")
            return Path(run.artifact_path).read_bytes(), "application/octet-stream", f"{run.id}_{run.selected_model}.joblib"
    if export_type == "all.zip":
        return build_all_zip(db, dataset, run_id), "application/zip", f"{dataset.id}_analysis_results.zip"
    raise HTTPException(status_code=404, detail="Unknown export type.")


def _get_completed_model_run(db: Session, dataset_id: str, run_id: str | None) -> ModelRun:
    if not run_id:
        raise HTTPException(status_code=422, detail="Provide run_id for this model-specific export.")
    run = db.get(ModelRun, run_id)
    if run is None or run.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Model run was not found for this dataset.")
    if run.data_revision != db.get(DatasetSession, dataset_id).data_revision:
        raise HTTPException(status_code=409, detail="This model run belongs to an earlier data revision. Re-run model comparison after cleaning before exporting a combined package.")
    if not run.completed or not run.evaluation_json:
        raise HTTPException(status_code=409, detail="Evaluate a selected model before downloading model-specific results.")
    return run


def build_all_zip(db: Session, dataset: DatasetSession, run_id: str | None = None) -> bytes:
    df = load_session_dataframe(dataset)
    profile = profile_dataframe(df)
    cleaning_log = get_cleaning_log(db, dataset.id)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("cleaned_dataset.csv", dataframe_csv_bytes(df))
        original_path = Path(dataset.original_upload_path).resolve()
        if original_path.is_file():
            archive.write(original_path, f"original_upload{dataset.file_extension}")
        archive.writestr("data_profile.json", json.dumps(profile, ensure_ascii=False, indent=2))
        archive.writestr("cleaning_log.json", json.dumps(cleaning_log, ensure_ascii=False, indent=2))
        charts = db.query(ChartRun).filter(ChartRun.dataset_id == dataset.id, ChartRun.data_revision == dataset.data_revision).all()
        for chart in charts:
            archive.writestr(f"charts/{chart.id}_{chart.chart_type}.json", json.dumps(chart.chart_data_json, ensure_ascii=False, indent=2))
            archive.writestr(f"charts/{chart.id}_{chart.chart_type}_data.csv", dataframe_csv_bytes(chart_to_dataframe(chart.chart_data_json)))
        if run_id:
            run = _get_completed_model_run(db, dataset.id, run_id)
            result = run.evaluation_json or {}
            archive.writestr("model_comparison.csv", dataframe_csv_bytes(pd.DataFrame([{"model": m["model"], "label": m["label"], **{f"cv_{k}": v for k, v in (m.get("cv_metrics") or {}).items()} } for m in result.get("comparison", [])])))
            archive.writestr("selected_model_metrics.json", json.dumps({"selected_model": run.selected_model, "metrics": result.get("metrics"), "classification_report": result.get("classification_report"), "configuration": result.get("model_configuration"), "interpretation": result.get("interpretation")}, ensure_ascii=False, indent=2))
            matrix = result.get("confusion_matrix", {})
            archive.writestr("confusion_matrix.csv", pd.DataFrame(matrix.get("matrix", []), index=matrix.get("labels", []), columns=matrix.get("labels", [])).rename_axis("actual").to_csv())
            if run.predictions_path and Path(run.predictions_path).is_file():
                archive.write(run.predictions_path, "test_predictions.csv")
            if run.artifact_path and Path(run.artifact_path).is_file():
                archive.write(run.artifact_path, f"selected_model_{run.selected_model}.joblib")
        manifest = {
            "dataset_session_id": dataset.id,
            "original_filename": dataset.original_filename,
            "data_revision": dataset.data_revision,
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "selected_model_run_id": run_id,
            "note": "The original upload is included unchanged as a separate archive entry. CSV export protects spreadsheet users from formula injection; this may prefix a leading apostrophe to formula-like text cells in CSV exports.",
        }
        archive.writestr("reproducibility_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return buffer.getvalue()
