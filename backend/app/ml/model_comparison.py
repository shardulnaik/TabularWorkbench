from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import make_scorer, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC

from app.ml.preprocessing import build_preprocessor

MODEL_LABELS = {
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest",
    "knn_classifier": "K-Nearest Neighbors",
    "svc_classifier": "Support Vector Machine (RBF)",
    "adaboost_classifier": "AdaBoost",
}


def build_model(model_name: str, X: pd.DataFrame) -> Pipeline:
    scale = model_name in {"logistic_regression", "knn_classifier", "svc_classifier"}
    preprocessor = build_preprocessor(X, scale_numeric=scale)
    if model_name == "logistic_regression":
        estimator = LogisticRegression(max_iter=1500, class_weight="balanced", random_state=42)
    elif model_name == "random_forest":
        estimator = RandomForestClassifier(n_estimators=160, min_samples_leaf=2, class_weight="balanced_subsample", random_state=42, n_jobs=-1)
    elif model_name == "knn_classifier":
        estimator = KNeighborsClassifier(n_neighbors=3, weights="distance", n_jobs=-1)
    elif model_name == "svc_classifier":
        estimator = SVC(kernel="rbf", class_weight="balanced", probability=True, random_state=42)
    elif model_name == "adaboost_classifier":
        estimator = AdaBoostClassifier(n_estimators=100, learning_rate=0.5, random_state=42)
    else:
        raise ValueError("Unsupported model selection")
    return Pipeline([("preprocessor", preprocessor), ("model", estimator)])


def get_scoring() -> dict:
    return {
        "accuracy": "accuracy",
        "balanced_accuracy": "balanced_accuracy",
        "f1_weighted": make_scorer(f1_score, average="weighted", zero_division=0),
        "precision_weighted": make_scorer(precision_score, average="weighted", zero_division=0),
        "recall_weighted": make_scorer(recall_score, average="weighted", zero_division=0),
    }


def compare_models(X_train: pd.DataFrame, y_train: pd.Series, random_state: int = 42) -> list[dict]:
    _, class_counts = np.unique(y_train, return_counts=True)
    if len(class_counts) < 2:
        raise ValueError("The training data must contain at least two target classes.")
    minimum_count = int(class_counts.min())
    if minimum_count < 2:
        raise ValueError("At least two examples of each class must remain in the training data for cross-validation.")
    cv = StratifiedKFold(n_splits=min(5, minimum_count), shuffle=True, random_state=random_state)
    scoring = get_scoring()
    results: list[dict] = []
    for model_name, label in MODEL_LABELS.items():
        pipeline = build_model(model_name, X_train)
        scores = cross_validate(pipeline, X_train, y_train, cv=cv, scoring=scoring, n_jobs=1, error_score=np.nan, return_train_score=False)
        metrics: dict[str, float | None] = {}
        for metric in scoring:
            values = scores.get(f"test_{metric}", np.array([]))
            valid = values[np.isfinite(values)]
            metrics[metric] = round(float(np.mean(valid)), 5) if len(valid) else None
        results.append({"model": model_name, "label": label, "cv_metrics": metrics, "folds": cv.n_splits})
    return results
