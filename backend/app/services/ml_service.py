from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.db.models import DatasetSession, ModelRun
from app.ml.artifacts import load_split_positions, save_split_manifest
from app.ml.evaluation import evaluate_classifier, evaluate_regressor
from app.ml.model_comparison import MODEL_LABELS, build_model, compare_models
from app.ml.preprocessing import prepare_ml_frame
from app.schemas.ml import ModelCompareRequest, ModelEvaluateRequest, ClusterRequest
from app.services.dataset_service import load_session_dataframe
from app.storage.local_artifacts import artifact_store
from app.utils.serialization import json_safe
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from app.ml.preprocessing import build_preprocessor
from sklearn.pipeline import Pipeline
from app.utils.data_types import column_kind, is_id_like, is_measure_like


def compare_dataset_models(db: Session, dataset: DatasetSession, request: ModelCompareRequest) -> dict:
    df = load_session_dataframe(dataset)
    if request.target_column not in df.columns:
        raise HTTPException(status_code=422, detail="Select a target column that exists in the dataset.")
    target_series = df[request.target_column]
    if target_series.isna().mean() > .4:
        raise HTTPException(status_code=422, detail="This target has more than 40% missing values. Choose another target or clean the dataset first.")
    if target_series.nunique(dropna=True) <= 1:
        raise HTTPException(status_code=422, detail="A target must contain at least two distinct non-missing values.")
    if (is_id_like(target_series, request.target_column) and not is_measure_like(target_series, request.target_column)):
        raise HTTPException(status_code=422, detail="Identifier-like columns cannot be used as targets.")
    if not pd.api.types.is_numeric_dtype(target_series) and (target_series.nunique(dropna=True) > 50 or (len(df) >= 20 and target_series.nunique(dropna=True) / max(int(target_series.notna().sum()), 1) > .8)):
        raise HTTPException(status_code=422, detail="This target has excessive cardinality and is likely an identifier. Choose another target.")
    allowed_metrics = {"accuracy", "f1_weighted", "recall_weighted", "precision_weighted"} if request.task_type == "classification" else {"mae", "mse", "rmse", "r2"}
    if request.scoring_metric not in allowed_metrics:
        raise HTTPException(status_code=422, detail=f"Choose a {request.task_type} scoring metric.")
    X, y, valid_positions, excluded = _prepare_or_422(df, request.target_column, request.task_type)
    # Numeric targets with many unique values are likely regression targets, not class labels.
    raw_target = df[request.target_column].dropna()
    is_continuous = pd.api.types.is_numeric_dtype(raw_target) and raw_target.nunique() > 20 and raw_target.nunique() / max(len(raw_target), 1) > 0.1
    if request.task_type == "classification" and is_continuous:
        raise HTTPException(status_code=422, detail="This is a continuous numeric target. Select Regression or choose a categorical target.")
    if request.task_type == "regression" and not is_continuous:
        raise HTTPException(status_code=422, detail="Regression requires a continuous numeric target column.")
    if y.nunique() < 2:
        raise HTTPException(status_code=422, detail="The target must contain at least two distinct classes.")
    if len(X) < 12:
        raise HTTPException(status_code=422, detail="At least 12 labelled rows are required for a basic training and evaluation split.")
    counts = y.value_counts()
    if request.task_type == "classification" and int(counts.min()) < 2:
        raise HTTPException(status_code=422, detail="Each target class needs at least two labelled examples. Add more examples or choose another target.")

    local_positions = np.arange(len(y), dtype=np.int64)
    try:
        train_local, test_local = train_test_split(
            local_positions, test_size=request.test_size, random_state=request.random_state, stratify=y.to_numpy() if request.task_type == "classification" else None
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Could not create a stratified holdout split: {str(exc)}") from exc
    train_positions = [valid_positions[int(i)] for i in train_local]
    test_positions = [valid_positions[int(i)] for i in test_local]
    X_train = X.iloc[train_local].reset_index(drop=True)
    y_train = y.iloc[train_local].reset_index(drop=True)
    try:
        results = compare_models(X_train, y_train, random_state=request.random_state, task_type=request.task_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    metric = request.scoring_metric
    reverse = request.task_type == "classification" or metric == "r2"
    results.sort(key=lambda row: (row["cv_metrics"].get(metric) is not None, (row["cv_metrics"].get(metric) or 0) if reverse else -(row["cv_metrics"].get(metric) or 0)), reverse=True)
    recommendation = results[0]["model"]
    run_id = str(uuid4())
    manifest = {
        "run_id": run_id,
        "target_column": request.target_column,
        "task_type": request.task_type,
        "feature_columns": list(X.columns),
        "excluded_columns": excluded,
        "valid_target_rows": len(valid_positions),
        "target_class_counts": {str(k): int(v) for k, v in counts.items()} if request.task_type == "classification" else {},
        "train_size": int(len(train_positions)),
        "test_size": int(len(test_positions)),
        "random_state": request.random_state,
        "test_fraction": request.test_size,
        "data_revision": dataset.data_revision,
        "scoring_metric": metric,
        "cv_folds": int(min(5, int(y_train.value_counts().min()))) if request.task_type == "classification" else int(min(5, max(2, len(y_train) // 2))),
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
    return {"model_run_id": run_id, "target_column": request.target_column, "task_type": request.task_type, "scoring_metric": metric, "models": results, "recommended_model": recommendation, "excluded_columns": excluded, "target_class_counts": manifest["target_class_counts"], "train_rows": manifest["train_size"], "test_rows": manifest["test_size"], "cv_folds": manifest["cv_folds"], "selection_note": "Candidate models are ranked on cross-validation within the training data. The held-out test set is used only after you select a model."}


def _prepare_or_422(df: pd.DataFrame, target: str, task_type: str = "classification"):
    try:
        return prepare_ml_frame(df, target, task_type)
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
    task_type = manifest.get("task_type", "classification")
    X, y, valid_positions, excluded = _prepare_or_422(df, run.target_column, task_type)
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
    if (task_type == "regression" and selected != "linear_regression") or (task_type == "classification" and selected == "linear_regression"):
        raise HTTPException(status_code=422, detail=f"Selected model is not available for {task_type}.")
    try:
        pipeline = build_model(selected, X_train)
        eval_result = evaluate_regressor(pipeline, X_train, y_train, X_test, y_test, [valid_positions[i] for i in test_mask]) if task_type == "regression" else evaluate_classifier(pipeline, X_train, y_train, X_test, y_test, [valid_positions[i] for i in test_mask], df[run.target_column])
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
        "task_type": task_type,
        "confusion_matrix": eval_result.get("confusion_matrix"),
        "classification_report": eval_result.get("classification_report"),
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


def cluster_dataset(dataset: DatasetSession, request: ClusterRequest) -> dict:
    df = load_session_dataframe(dataset)
    if len(set(request.feature_columns)) != len(request.feature_columns):
        raise HTTPException(status_code=422, detail="Choose each clustering feature only once.")
    if any(column not in df.columns for column in request.feature_columns):
        raise HTTPException(status_code=422, detail="One or more selected clustering features do not exist.")
    X = df[request.feature_columns].copy()
    unsuitable = [c for c in X if X[c].isna().mean() > .4 or X[c].nunique(dropna=True) <= 1 or (is_id_like(X[c], str(c)) and not is_measure_like(X[c], str(c))) or (not pd.api.types.is_numeric_dtype(X[c]) and (X[c].nunique(dropna=True) > 50 or (len(X) >= 20 and X[c].nunique(dropna=True) / max(int(X[c].notna().sum()), 1) > .8))) or column_kind(X[c], str(c)) == "datetime"]
    if unsuitable:
        raise HTTPException(status_code=422, detail=f"Remove unsuitable clustering features: {', '.join(unsuitable)}.")
    valid = X.notna().any(axis=1)
    valid_positions = np.flatnonzero(valid.to_numpy())
    X = X.loc[valid].reset_index(drop=True)
    if len(X) < max(10, request.n_clusters + 1):
        raise HTTPException(status_code=422, detail="Clustering needs at least 10 usable rows and more rows than clusters.")
    try:
        pipeline = Pipeline([("preprocessor", build_preprocessor(X)), ("model", KMeans(n_clusters=request.n_clusters, n_init=10, random_state=request.random_state))])
        labels = pipeline.fit_predict(X)
        transformed = pipeline.named_steps["preprocessor"].transform(X)
        if len(set(labels)) < 2 or len(set(labels)) >= len(labels):
            raise ValueError("K-Means did not produce at least two non-empty clusters.")
        metrics = {"silhouette_score": float(silhouette_score(transformed, labels)), "davies_bouldin_index": float(davies_bouldin_score(transformed, labels)), "calinski_harabasz_score": float(calinski_harabasz_score(transformed, labels))}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Clustering could not be completed: {exc}") from exc
    cluster_ids, cluster_counts = np.unique(labels, return_counts=True)
    return json_safe({"task_type": "clustering", "model": "kmeans", "model_label": "K-Means", "feature_columns": request.feature_columns, "n_clusters": request.n_clusters, "metrics": metrics, "cluster_counts": {str(int(k)): int(v) for k, v in zip(cluster_ids, cluster_counts)}, "assignments": [{"row_number": int(position) + 1, "cluster": int(label)} for position, label in zip(valid_positions, labels)], "excluded_rows": int((~valid).sum()), "preprocessing": "Median imputation and scaling for numeric fields; most frequent imputation and one-hot encoding for categorical fields."})
