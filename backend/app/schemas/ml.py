from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ModelTrainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_column: str = Field(min_length=1, max_length=255)


class SinglePredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model_run_id: str = Field(min_length=1, max_length=36)
    inputs: dict[str, Any]
