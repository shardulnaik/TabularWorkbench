from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score
from sklearn.pipeline import Pipeline


def evaluate_regressor(pipeline: Pipeline, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    mse = float(mean_squared_error(y_test, predictions))
    return {"metrics": {
        "mae": float(mean_absolute_error(y_test, predictions)),
        "mse": mse,
        "rmse": float(np.sqrt(mse)),
        "r2": float(r2_score(y_test, predictions)) if y_test.nunique() >= 2 else None,
        "test_rows": int(len(y_test)),
    }}


def evaluate_classifier(pipeline: Pipeline, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test).astype(str)
    actual = y_test.astype(str)
    return {"metrics": {
        "accuracy": float(accuracy_score(actual, predictions)),
        "precision_weighted": float(precision_score(actual, predictions, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(actual, predictions, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(actual, predictions, average="weighted", zero_division=0)),
        "test_rows": int(len(y_test)),
    }}
