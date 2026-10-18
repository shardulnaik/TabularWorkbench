from typing import Literal
from pydantic import BaseModel, Field


ScoringMetric = Literal["accuracy", "f1_weighted", "recall_weighted", "balanced_accuracy", "precision_weighted"]
ModelName = Literal["logistic_regression", "random_forest", "knn_classifier", "svc_classifier", "adaboost_classifier"]


class ModelCompareRequest(BaseModel):
    target_column: str = Field(min_length=1, max_length=255)
    scoring_metric: ScoringMetric = "accuracy"
    test_size: float = Field(default=0.2, ge=0.15, le=0.4)
    random_state: int = Field(default=42, ge=0, le=2147483647)


class ModelEvaluateRequest(BaseModel):
    model_run_id: str
    selected_model: ModelName
