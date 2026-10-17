from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline

from app.utils.serialization import json_safe


def evaluate_classifier(pipeline: Pipeline, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series, test_positions: list[int], original_target: pd.Series) -> dict:
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test).astype(str)
    classes = [str(c) for c in pipeline.named_steps["model"].classes_]
    labels = sorted(set(y_test.astype(str).tolist()) | set(predictions.tolist()))
    matrix = confusion_matrix(y_test.astype(str), predictions, labels=labels)
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "precision_weighted": float(precision_score(y_test, predictions, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(y_test, predictions, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y_test, predictions, average="weighted", zero_division=0)),
        "test_rows": int(len(y_test)),
    }
    report = classification_report(y_test.astype(str), predictions, labels=labels, output_dict=True, zero_division=0)
    roc_auc = None
    try:
        model = pipeline.named_steps["model"]
        probabilities = pipeline.predict_proba(X_test)
        if len(classes) == 2:
            positive_class = classes[1]
            binary_truth = (y_test.astype(str).to_numpy() == positive_class).astype(int)
            roc_auc = float(roc_auc_score(binary_truth, probabilities[:, 1]))
        elif len(classes) > 2 and set(y_test.astype(str).unique()) == set(classes):
            roc_auc = float(roc_auc_score(y_test.astype(str), probabilities, labels=classes, multi_class="ovr", average="weighted"))
    except (ValueError, AttributeError, IndexError):
        roc_auc = None
    metrics["roc_auc"] = roc_auc
    pred_frame = pd.DataFrame({
        "row_number": [int(p) + 1 for p in test_positions],
        "actual": y_test.astype(str).tolist(),
        "predicted": predictions.tolist(),
        "correct": (y_test.astype(str).to_numpy() == predictions).tolist(),
    })
    try:
        probabilities = pipeline.predict_proba(X_test)
        for index, label in enumerate(classes):
            safe_label = "".join(ch if ch.isalnum() else "_" for ch in label)[:50] or f"class_{index}"
            pred_frame[f"probability_{safe_label}"] = probabilities[:, index]
    except (AttributeError, ValueError):
        pass

    feature_signals = []
    try:
        preprocessor = pipeline.named_steps["preprocessor"]
        feature_names = list(preprocessor.get_feature_names_out())
        model = pipeline.named_steps["model"]
        if hasattr(model, "feature_importances_"):
            importance = np.asarray(model.feature_importances_)
        elif hasattr(model, "coef_"):
            importance = np.abs(np.asarray(model.coef_)).mean(axis=0)
        else:
            importance = np.array([])
        if len(importance) == len(feature_names):
            order = np.argsort(importance)[::-1][:10]
            feature_signals = [{"feature": feature_names[int(i)], "importance": float(importance[int(i)])} for i in order if np.isfinite(importance[int(i)])]
    except (ValueError, AttributeError, IndexError):
        feature_signals = []

    return json_safe({
        "metrics": metrics,
        "class_labels": labels,
        "confusion_matrix": {"labels": labels, "matrix": matrix.tolist()},
        "classification_report": report,
        "feature_signals": feature_signals,
        "predictions": pred_frame.to_dict(orient="records"),
        "interpretation": "Metrics describe this held-out test split. They do not guarantee performance on future data. Feature signals show model associations, not causation.",
    })
