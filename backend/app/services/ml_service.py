from __future__ import annotations

from collections import Counter
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.db.models import DatasetSession, ModelRun
from app.ml.artifacts import load_split_positions, save_split_manifest
from app.ml.evaluation import evaluate_classifier
from app.ml.model_comparison import MODEL_LABELS, build_model, compare_models
from app.ml.preprocessing import prepare_ml_frame
from app.schemas.ml import ModelCompareRequest, ModelEvaluateRequest
from app.services.dataset_service import load_session_dataframe
from app.storage.local_artifacts import artifact_store
from app.utils.serialization import json_safe


def compare_dataset_models(db: Session, dataset: DatasetSession, request: ModelCompareRequest) -> dict:
    df = load_session_dataframe(dataset)
    if request.target_column not in df.columns:
        raise HTTPException(status_code=422, detail="Select a target column that exists in the dataset.")
    X, y, valid_positions, excluded = _prepare_or_422(df, request.target_column)
    # Numeric targets with many unique values are likely regression targets, not class labels.
    raw_target = df[request.target_column].dropna()
    if pd.api.types.is_numeric_dtype(raw_target) and raw_target.nunique() > 20 and raw_target.nunique() / max(len(raw_target), 1) > 0.1:
        raise HTTPException(status_code=422, detail="This target appears continuous. The first release supports classification; regression is planned for a later version.")
    if y.nunique() < 2:
        raise HTTPException(status_code=422, detail="The target must contain at least two distinct classes.")
    if len(X) < 12:
        raise HTTPException(status_code=422, detail="At least 12 labelled rows are required for a basic training and evaluation split.")
    counts = y.value_counts()
    if int(counts.min()) < 2:
        raise HTTPException(status_code=422, detail="Each target class needs at least two labelled examples. Add more examples or choose another target.")

    local_positions = np.arange(len(y), dtype=np.int64)
    try:
        train_local, test_local = train_test_split(
            local_positions, test_size=request.test_size, random_state=request.random_state, stratify=y.to_numpy()
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Could not create a stratified holdout split: {str(exc)}") from exc
    train_positions = [valid_positions[int(i)] for i in train_local]
    test_positions = [valid_positions[int(i)] for i in test_local]
    X_train = X.iloc[train_local].reset_index(drop=True)
    y_train = y.iloc[train_local].reset_index(drop=True)
    try:
        results = compare_models(X_train, y_train, random_state=request.random_state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    metric = request.scoring_metric
    results.sort(key=lambda row: (row["cv_metrics"].get(metric) is not None, row["cv_metrics"].get(metric) or -1), reverse=True)
    recommendation = results[0]["model"]
    run_id = str(uuid4())
    manifest = {
        "run_id": run_id,
        "target_column": request.target_column,
        "feature_columns": list(X.columns),
        "excluded_columns": excluded,
        "valid_target_rows": len(valid_positions),
        "target_class_counts": {str(k): int(v) for k, v in counts.items()},
        "train_size": int(len(train_positions)),
        "test_size": int(len(test_positions)),
        "random_state": request.random_state,
        "test_fraction": request.test_size,
        "data_revision": dataset.data_revision,
        "scoring_metric": metric,
        "cv_folds": int(min(5, int(y_train.value_counts().min()))),
    }
    manifest_path, split_path = save_split_manifest(dataset.id, run_id, manifest, train_positions, test_positions)
    run = ModelRun(
        id=run_id, dataset_id=dataset.id, data_revision=dataset.data_revision,
        target_column=request.target_column, scoring_metric=metric,
        comparison_json={"models": json_safe(results), "recommended_model": recommendation, "manifest": manifest},
        split_manifest_path=str(split_path), completed=False,
    )
    db.add(run)
    db.commit()
    return {"model_run_id": run_id, "target_column": request.target_column, "scoring_metric": metric, "models": results, "recommended_model": recommendation, "excluded_columns": excluded, "target_class_counts": manifest["target_class_counts"], "train_rows": manifest["train_size"], "test_rows": manifest["test_size"], "cv_folds": manifest["cv_folds"], "selection_note": "Candidate models are ranked on cross-validation within the training data. The held-out test set is used only after you select a model."}


def _prepare_or_422(df: pd.DataFrame, target: str):
    try:
        return prepare_ml_frame(df, target)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def evaluate_selected_model(db: Session, dataset: DatasetSession, request: ModelEvaluateRequest) -> dict:
    run = db.get(ModelRun, request.model_run_id)
    if run is None or run.dataset_id != dataset.id:
        raise HTTPException(status_code=404, detail="Model comparison run was not found for this dataset.")
    if run.data_revision != dataset.data_revision:
        raise HTTPException(status_code=409, detail="The dataset changed after this comparison. Run model comparison again before evaluating a model.")
    manifest_path = Path(run.split_manifest_path).with_name(f"model_run_{run.id}_manifest.json")
    try:
        manifest = artifact_store.load_json(str(manifest_path))
        train_positions, test_positions = load_split_positions(run.split_manifest_path)
        df = load_session_dataframe(dataset).reset_index(drop=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    X, y, valid_positions, excluded = _prepare_or_422(df, run.target_column)
    # The stored positions refer to original cleaned-data row numbers; filter target-missing rows identically.
    train_position_set = set(train_positions)
    test_position_set = set(test_positions)
    train_mask = [i for i, p in enumerate(valid_positions) if p in train_position_set]
    test_mask = [i for i, p in enumerate(valid_positions) if p in test_position_set]
    if not train_mask or not test_mask:
        raise HTTPException(status_code=409, detail="The stored split no longer matches this dataset. Run comparison again.")
    X_train, y_train = X.iloc[train_mask].reset_index(drop=True), y.iloc[train_mask].reset_index(drop=True)
    X_test, y_test = X.iloc[test_mask].reset_index(drop=True), y.iloc[test_mask].reset_index(drop=True)
    selected = request.selected_model
    try:
        pipeline = build_model(selected, X_train)
        eval_result = evaluate_classifier(pipeline, X_train, y_train, X_test, y_test, [valid_positions[i] for i in test_mask], df[run.target_column])
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"The selected model could not be evaluated: {str(exc)[:220]}") from exc

    artifact_path = artifact_store.save_model(dataset.id, f"selected_model_{run.id}_{selected}.joblib", pipeline)
    pred_path = artifact_store.path(dataset.id, f"selected_model_{run.id}_predictions.csv")
    pd.DataFrame(eval_result["predictions"]).to_csv(pred_path, index=False)
    result_payload = {
        "model_run_id": run.id,
        "selected_model": selected,
        "selected_model_label": MODEL_LABELS[selected],
        "target_column": run.target_column,
        "scoring_metric": run.scoring_metric,
        "comparison": run.comparison_json.get("models", []),
        "recommended_model": run.comparison_json.get("recommended_model"),
        "metrics": eval_result["metrics"],
        "confusion_matrix": eval_result["confusion_matrix"],
        "classification_report": eval_result["classification_report"],
        "feature_signals": eval_result["feature_signals"],
        "prediction_preview": eval_result["predictions"][:100],
        "prediction_count": len(eval_result["predictions"]),
        "excluded_columns": manifest.get("excluded_columns", excluded),
        "train_rows": manifest["train_size"],
        "test_rows": manifest["test_size"],
        "cv_folds": manifest["cv_folds"],
        "data_revision": dataset.data_revision,
        "model_configuration": {
            "model": selected,
            "parameters": pipeline.named_steps["model"].get_params(deep=False),
            "preprocessing": "Numeric median imputation; scaling for Logistic Regression; categorical explicit-missing imputation and one-hot encoding. Preprocessing was fitted within the model pipeline.",
            "random_state": manifest["random_state"],
            "scoring_metric": run.scoring_metric,
        },
        "interpretation": eval_result["interpretation"],
        "artifact_available": True,
    }
    run.selected_model = selected
    run.evaluation_json = json_safe(result_payload)
    run.artifact_path = str(artifact_path)
    run.predictions_path = str(pred_path)
    run.completed = True
    db.add(run)
    db.commit()
    return json_safe(result_payload)


def get_model_run(db: Session, dataset_id: str, run_id: str) -> dict:
    run = db.get(ModelRun, run_id)
    if run is None or run.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Model run was not found.")
    if not run.completed or not run.evaluation_json:
        return {"model_run_id": run.id, "completed": False, "comparison": run.comparison_json}
    return {**run.evaluation_json, "completed": True}


def get_comparison(db: Session, dataset_id: str, run_id: str) -> dict:
    run = db.get(ModelRun, run_id)
    if run is None or run.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Model run was not found.")
    return {"model_run_id": run.id, "models": run.comparison_json.get("models", []), "recommended_model": run.comparison_json.get("recommended_model"), "scoring_metric": run.scoring_metric, "target_column": run.target_column}
