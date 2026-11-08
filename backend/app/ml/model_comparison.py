from __future__ import annotations

import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.pipeline import Pipeline

from app.ml.preprocessing import build_preprocessor

MODEL_LABELS = {
    "random_forest_classifier": "Random Forest Classifier",
    "random_forest_regressor": "Random Forest Regressor",
}


def build_model(task_type: str, X: pd.DataFrame, random_state: int = 42) -> Pipeline:
    preprocessor = build_preprocessor(X, scale_numeric=False)
    if task_type == "classification":
        estimator = RandomForestClassifier(
            n_estimators=200,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1,
        )
    elif task_type == "regression":
        estimator = RandomForestRegressor(
            n_estimators=200,
            min_samples_leaf=2,
            random_state=random_state,
            n_jobs=-1,
        )
    else:
        raise ValueError("The target must be classified as classification or regression.")
    return Pipeline([("preprocessor", preprocessor), ("model", estimator)])
