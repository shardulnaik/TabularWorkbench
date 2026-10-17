from typing import Literal
from pydantic import BaseModel, Field


ChartType = Literal["histogram", "bar", "line", "scatter", "correlation_heatmap"]
Aggregation = Literal["mean", "sum", "count", "median"]


class ChartRequest(BaseModel):
    chart_type: ChartType
    x_column: str | None = Field(default=None, max_length=255)
    y_column: str | None = Field(default=None, max_length=255)
    aggregation: Aggregation = "mean"
