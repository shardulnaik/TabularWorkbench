from __future__ import annotations

import math
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.db.models import DatasetSession, ModelRun
from app.ml.artifacts import save_split_manifest
from app.ml.evaluation import evaluate_classifier, evaluate_regressor
from app.ml.model_comparison import MODEL_LABELS, build_model
from app.ml.preprocessing import prepare_ml_frame
from app.schemas.ml import ModelTrainRequest, SinglePredictionRequest
from app.services.dataset_service import load_session_dataframe
from app.storage.local_artifacts import artifact_store
from app.utils.data_types import detect_target_task, is_id_like
from app.utils.serialization import json_safe


def train_for_target(db: Session, dataset: DatasetSession, request: ModelTrainRequest) -> dict:
    df = load_session_dataframe(dataset).reset_index(drop=True)
    if request.target_column not in df.columns:
        raise HTTPException(status_code=422, detail="Select a target column that exists in this CSV.")
    target = df[request.target_column]
    if target.isna().mean() > 0.4:
        raise HTTPException(status_code=422, detail="This target has more than 40% missing values. Choose another target or clean it first.")
    if is_id_like(target, request.target_column):
        raise HTTPException(status_code=422, detail="This column looks like an identifier and is not a suitable prediction target.")
    try:
        task_type, numeric_target, task_reason = detect_target_task(target)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if target.nunique(dropna=True) < 2:
        raise HTTPException(status_code=422, detail="The target must contain at least two distinct values.")
    if not numeric_target and target.nunique(dropna=True) > 50:
        raise HTTPException(status_code=422, detail="This categorical target has too many distinct values and may be an identifier.")

    X, y, valid_positions, excluded = _prepare_or_422(df, request.target_column, task_type)
    if len(X) < 10:
        raise HTTPException(status_code=422, detail="At least 10 labeled rows are required for a train/test evaluation and prediction model.")

    class_counts: dict[str, int] = {}
    stratify = None
    if task_type == "classification":
        counts = y.value_counts()
        if len(counts) < 2:
            raise HTTPException(status_code=422, detail="Classification needs at least two target classes.")
        if int(counts.min()) < 2:
            raise HTTPException(status_code=422, detail="Each class needs at least two labeled rows to train and evaluate fairly. Add examples or choose another target.")
        class_counts = {str(label): int(count) for label, count in counts.items()}
        stratify = y.to_numpy()
        test_count = max(math.ceil(len(y) * 0.2), len(counts))
        if len(y) - test_count < len(counts):
            raise HTTPException(status_code=422, detail="There are too many classes for a reliable stratified train/test split.")
    else:
        test_count = max(2, math.ceil(len(y) * 0.2))

    model_name = "random_forest_classifier" if task_type == "classification" else "random_forest_regressor"
    run_id = str(uuid4())
    try:
        train_local, test_local = train_test_split(
            np.arange(len(y)), test_size=test_count, random_state=42, stratify=stratify
        )
        X_train, X_test = X.iloc[train_local].reset_index(drop=True), X.iloc[test_local].reset_index(drop=True)
        y_train, y_test = y.iloc[train_local].reset_index(drop=True), y.iloc[test_local].reset_index(drop=True)
        evaluation_pipeline = build_model(task_type, X_train)
        test_positions = [valid_positions[int(index)] for index in test_local]
        if task_type == "classification":
            evaluation = evaluate_classifier(evaluation_pipeline, X_train, y_train, X_test, y_test)
        else:
            evaluation = evaluate_regressor(evaluation_pipeline, X_train, y_train, X_test, y_test)
        # Keep a separate final pipeline trained on all labeled rows for interactive inference.
        final_pipeline = build_model(task_type, X)
        final_pipeline.fit(X, y)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"This target/features combination could not be trained: {str(exc)[:220]}") from exc

    feature_schema = _feature_schema(X)
    warnings = []
    if len(X) < 100:
        warnings.append("This is a small dataset; evaluation scores may vary substantially with different rows.")
    if task_type == "classification" and min(class_counts.values()) / len(y) < 0.05:
        warnings.append("The target classes are imbalanced. Class weighting is enabled; review per-class results before relying on predictions.")
    if all(value is None or (isinstance(value, float) and not np.isfinite(value)) for key, value in evaluation["metrics"].items() if key != "test_rows"):
        raise HTTPException(status_code=422, detail="The held-out data did not support a meaningful evaluation metric. More labeled rows are needed.")

    manifest = {
        "run_id": run_id,
        "target_column": request.target_column,
        "task_type": task_type,
        "model": model_name,
        "feature_columns": list(X.columns),
        "excluded_columns": excluded,
        "train_size": int(len(train_local)),
        "test_size": int(len(test_local)),
        "data_revision": dataset.data_revision,
    }
    _, split_path = save_split_manifest(
        dataset.id, run_id, manifest,
        [valid_positions[int(index)] for index in train_local],
        test_positions,
    )
    artifact_path = artifact_store.save_model(dataset.id, f"trained_model_{run_id}.joblib", final_pipeline)
    result = {
        "model_run_id": run_id,
        "target_column": request.target_column,
        "task_type": task_type,
        "task_reason": task_reason,
        "model": model_name,
        "model_label": MODEL_LABELS[model_name],
        "metrics": evaluation["metrics"],
        "feature_schema": feature_schema,
        "excluded_columns": excluded,
        "train_rows": int(len(train_local)),
        "test_rows": int(len(test_local)),
        "class_counts": class_counts,
        "warnings": warnings,
        "evaluation_note": "Metrics are calculated only on held-out labeled rows. They estimate performance and do not guarantee future predictions.",
    }
    run = ModelRun(
        id=run_id,
        dataset_id=dataset.id,
        data_revision=dataset.data_revision,
        target_column=request.target_column,
        scoring_metric="accuracy" if task_type == "classification" else "mae",
        comparison_json={"manifest": manifest},
        split_manifest_path=str(split_path),
        selected_model=model_name,
        evaluation_json=json_safe(result),
        artifact_path=str(artifact_path),
        predictions_path=None,
        completed=True,
    )
    db.add(run)
    db.commit()
    return json_safe(result)


def _prepare_or_422(df: pd.DataFrame, target: str, task_type: str):
    try:
        return prepare_ml_frame(df, target, task_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _feature_schema(X: pd.DataFrame) -> list[dict]:
    schema = []
    numeric_columns = set(X.select_dtypes(include=["number"]).columns)
    for name in X.columns:
        series = X[name]
        if name in numeric_columns:
            schema.append({"name": str(name), "kind": "numeric"})
        else:
            categories = series.dropna().astype(str).value_counts().head(100).index.tolist()
            schema.append({"name": str(name), "kind": "categorical", "categories": categories})
    return schema


def predict_one(db: Session, dataset: DatasetSession, request: SinglePredictionRequest) -> dict:
    run = db.get(ModelRun, request.model_run_id)
    if run is None or run.dataset_id != dataset.id:
        raise HTTPException(status_code=404, detail="Trained model was not found for this dataset.")
    if run.data_revision != dataset.data_revision:
        raise HTTPException(status_code=409, detail="The dataset changed after training. Train the model again before predicting.")
    if not run.completed or not run.evaluation_json or not run.artifact_path:
        raise HTTPException(status_code=409, detail="The model is not ready for predictions. Train it again.")
    schema = run.evaluation_json.get("feature_schema", [])
    expected = [feature["name"] for feature in schema]
    provided = list(request.inputs.keys())
    missing = [name for name in expected if name not in request.inputs]
    extra = [name for name in provided if name not in expected]
    if missing or extra:
        details = []
        if missing: details.append(f"missing inputs: {', '.join(missing)}")
        if extra: details.append(f"unexpected inputs: {', '.join(extra)}")
        raise HTTPException(status_code=422, detail="Input fields must match the trained feature form exactly (" + "; ".join(details) + ").")

    row = {}
    unseen_categories = []
    for feature in schema:
        name = feature["name"]
        value = request.inputs[name]
        if value is None or (isinstance(value, str) and not value.strip()):
            raise HTTPException(status_code=422, detail=f"Enter a value for {name}.")
        elif feature["kind"] == "numeric":
            if isinstance(value, bool):
                raise HTTPException(status_code=422, detail=f"{name} must be a number.")
            try:
                numeric_value = float(value)
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail=f"{name} must be a number.") from exc
            if not np.isfinite(numeric_value):
                raise HTTPException(status_code=422, detail=f"{name} must be a finite number.")
            row[name] = numeric_value
        else:
            if isinstance(value, (dict, list)):
                raise HTTPException(status_code=422, detail=f"{name} must be a category value.")
            category = str(value)
            row[name] = category
            if category not in feature.get("categories", []):
                unseen_categories.append(name)

    X_new = pd.DataFrame([row], columns=expected)
    for feature in schema:
        name = feature["name"]
        if feature["kind"] == "numeric":
            X_new[name] = pd.to_numeric(X_new[name], errors="coerce").astype(float)
        else:
            X_new[name] = X_new[name].astype(object)
    try:
        pipeline = artifact_store.load_model(run.artifact_path)
        prediction = pipeline.predict(X_new)[0]
        probabilities = None
        if run.evaluation_json["task_type"] == "classification" and hasattr(pipeline, "predict_proba"):
            probabilities = {str(label): float(score) for label, score in zip(pipeline.named_steps["model"].classes_, pipeline.predict_proba(X_new)[0])}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail="The trained model artifact has expired. Train the model again.") from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"The prediction inputs could not be processed: {str(exc)[:200]}") from exc

    result = {
        "model_run_id": run.id,
        "target_column": run.target_column,
        "task_type": run.evaluation_json["task_type"],
        "predicted_value": str(prediction) if run.evaluation_json["task_type"] == "classification" else float(prediction),
        "probabilities": probabilities,
        "warnings": [f"Unseen category in {name}; the model can process it, but has no learned category-specific pattern." for name in unseen_categories],
    }
    return json_safe(result)


def get_model_run(db: Session, dataset_id: str, run_id: str) -> dict:
    run = db.get(ModelRun, run_id)
    if run is None or run.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Model run was not found.")
    if not run.completed or not run.evaluation_json:
        raise HTTPException(status_code=410, detail="The trained model details are not available.")
    if run.data_revision != db.get(DatasetSession, dataset_id).data_revision:
        raise HTTPException(status_code=409, detail="The dataset changed after this model was trained.")
    return {**run.evaluation_json, "completed": True, "artifact_available": bool(run.artifact_path and Path(run.artifact_path).is_file())}
