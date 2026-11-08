from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import make_scorer, f1_score, precision_score, recall_score, mean_squared_error, mean_absolute_error, r2_score
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

from app.ml.preprocessing import build_preprocessor

CLASSIFICATION_MODELS = {
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest Classifier",
    "knn_classifier": "K-Nearest Neighbors",
}
REGRESSION_MODELS = {"linear_regression": "Linear Regression"}
MODEL_LABELS = {**CLASSIFICATION_MODELS, **REGRESSION_MODELS}


def build_model(model_name: str, X: pd.DataFrame) -> Pipeline:
    scale = model_name in {"logistic_regression", "knn_classifier", "linear_regression"}
    preprocessor = build_preprocessor(X, scale_numeric=scale)
    if model_name == "logistic_regression":
        estimator = LogisticRegression(max_iter=1500, class_weight="balanced", random_state=42)
    elif model_name == "random_forest":
        estimator = RandomForestClassifier(n_estimators=160, min_samples_leaf=2, class_weight="balanced_subsample", random_state=42, n_jobs=-1)
    elif model_name == "knn_classifier":
        estimator = KNeighborsClassifier(n_neighbors=3, weights="distance", n_jobs=-1)
    elif model_name == "linear_regression":
        estimator = LinearRegression()
    else:
        raise ValueError("Unsupported model selection")
    return Pipeline([("preprocessor", preprocessor), ("model", estimator)])


def compare_models(X_train: pd.DataFrame, y_train: pd.Series, random_state: int = 42, task_type: str = "classification") -> list[dict]:
    if task_type == "regression":
        if len(y_train) < 4:
            raise ValueError("At least four training rows are required for regression cross-validation.")
        cv = KFold(n_splits=min(5, max(2, len(y_train) // 2)), shuffle=True, random_state=random_state)
        scoring = {"mae": "neg_mean_absolute_error", "mse": "neg_mean_squared_error", "r2": "r2"}
        model_names = REGRESSION_MODELS
    else:
        _, counts = np.unique(y_train, return_counts=True)
        if len(counts) < 2 or int(counts.min()) < 2:
            raise ValueError("At least two examples of each target class must remain in training data for cross-validation.")
        cv = StratifiedKFold(n_splits=min(5, int(counts.min())), shuffle=True, random_state=random_state)
        scoring = {"accuracy": "accuracy", "f1_weighted": make_scorer(f1_score, average="weighted", zero_division=0), "precision_weighted": make_scorer(precision_score, average="weighted", zero_division=0), "recall_weighted": make_scorer(recall_score, average="weighted", zero_division=0)}
        model_names = CLASSIFICATION_MODELS
    results = []
    for model_name, label in model_names.items():
        scores = cross_validate(build_model(model_name, X_train), X_train, y_train, cv=cv, scoring=scoring, n_jobs=1, error_score=np.nan)
        metrics = {}
        for key in scoring:
            vals = scores[f"test_{key}"]
            vals = vals[np.isfinite(vals)]
            if len(vals):
                value = float(np.mean(vals))
                if key in {"mae", "mse"}: value = -value
                metrics[key] = round(value, 5)
            else: metrics[key] = None
        if task_type == "regression":
            metrics["rmse"] = round(float(np.sqrt(metrics["mse"])), 5) if metrics["mse"] is not None else None
        results.append({"model": model_name, "label": label, "cv_metrics": metrics, "folds": cv.n_splits})
    return results
