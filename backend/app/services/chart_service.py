from __future__ import annotations

import uuid

import numpy as np
import pandas as pd
from fastapi import HTTPException
from pandas.api.types import is_datetime64_any_dtype, is_numeric_dtype
from sqlalchemy.orm import Session

from app.db.models import ChartRun, DatasetSession
from app.schemas.charts import ChartRequest
from app.utils.data_types import column_kind
from app.utils.serialization import json_safe

MAX_CHART_POINTS = 2000


def _require_column(df: pd.DataFrame, name: str | None, label: str) -> str:
    if not name:
        raise HTTPException(status_code=422, detail=f"Choose a column for {label}.")
    if name not in df.columns:
        raise HTTPException(status_code=422, detail=f"The selected {label} column does not exist in this dataset.")
    return name


def generate_chart_data(df: pd.DataFrame, request: ChartRequest) -> dict:
    chart_type = request.chart_type
    if chart_type == "correlation_heatmap":
        numeric = df.select_dtypes(include="number")
        if numeric.shape[1] < 2:
            raise HTTPException(status_code=422, detail="A correlation heatmap requires at least two numeric columns.")
        numeric = numeric.iloc[:, :30]
        corr = numeric.corr(numeric_only=True).fillna(0).round(4)
        return {"chart_type": chart_type, "title": "Numeric column correlations", "columns": list(corr.columns), "matrix": corr.values.tolist(), "data": [{"x": str(col_x), "y": str(col_y), "value": float(corr.loc[col_y, col_x])} for col_y in corr.index for col_x in corr.columns]}

    x = _require_column(df, request.x_column, "X-axis")
    x_series = df[x]

    if chart_type == "histogram":
        if not is_numeric_dtype(x_series):
            raise HTTPException(status_code=422, detail="A histogram requires a numeric X-axis column.")
        values = x_series.dropna().astype(float).to_numpy()
        if not len(values):
            raise HTTPException(status_code=422, detail="The selected column has no numeric values to plot.")
        bin_count = max(5, min(30, int(np.sqrt(len(values)))))
        counts, edges = np.histogram(values, bins=bin_count)
        data = [{"bin": f"{edges[i]:.4g} – {edges[i + 1]:.4g}", "count": int(counts[i]), "midpoint": float((edges[i] + edges[i + 1]) / 2)} for i in range(len(counts))]
        return {"chart_type": chart_type, "title": f"Distribution of {x}", "x_key": "bin", "y_key": "count", "data": data, "sample_count": int(len(values))}

    y = request.y_column
    if chart_type in {"line", "scatter"} and not y:
        raise HTTPException(status_code=422, detail=f"{chart_type.title()} charts require both X-axis and Y-axis columns.")
    if chart_type == "bar" and y:
        if y not in df.columns:
            raise HTTPException(status_code=422, detail="The selected Y-axis column does not exist in this dataset.")
        if not is_numeric_dtype(df[y]):
            raise HTTPException(status_code=422, detail="For a bar chart with a Y-axis, select a numeric Y-axis column.")
        working = df[[x, y]].dropna(subset=[x, y]).copy()
        if working.empty:
            raise HTTPException(status_code=422, detail="No complete rows are available for the selected columns.")
        agg = request.aggregation
        grouped = working.groupby(x, dropna=False, observed=False)[y]
        if agg == "sum":
            result = grouped.sum()
        elif agg == "count":
            result = grouped.count()
        elif agg == "median":
            result = grouped.median()
        else:
            result = grouped.mean()
        result = result.sort_values(ascending=False).head(100) if len(result) > 100 else result
        data = [{"x": str(k)[:160], "y": float(v)} for k, v in result.items() if pd.notna(v)]
        return {"chart_type": chart_type, "title": f"{y} by {x}", "x_key": "x", "y_key": "y", "aggregation": agg, "data": data, "note": "Rows with the same X value are combined using the selected aggregation."}

    if chart_type == "bar":
        counts = x_series.astype("string").fillna("(Missing)").value_counts().head(100)
        data = [{"x": str(k)[:160], "y": int(v)} for k, v in counts.items()]
        return {"chart_type": chart_type, "title": f"Counts by {x}", "x_key": "x", "y_key": "y", "data": data, "note": "Showing up to 100 most frequent values."}

    if y not in df.columns:
        raise HTTPException(status_code=422, detail="The selected Y-axis column does not exist in this dataset.")
    y_series = df[y]
    if not is_numeric_dtype(y_series):
        raise HTTPException(status_code=422, detail=f"The Y-axis column for a {chart_type} chart must be numeric.")

    working = df[[x, y]].dropna().copy()
    if working.empty:
        raise HTTPException(status_code=422, detail="No complete rows are available for the selected columns.")
    if chart_type == "scatter":
        if not is_numeric_dtype(x_series):
            raise HTTPException(status_code=422, detail="A scatter plot requires numeric columns on both axes.")
        if len(working) > MAX_CHART_POINTS:
            working = working.sample(n=MAX_CHART_POINTS, random_state=42)
        return {"chart_type": chart_type, "title": f"{y} vs {x}", "x_key": "x", "y_key": "y", "data": [{"x": float(a), "y": float(b)} for a, b in working.itertuples(index=False, name=None)], "sample_count": int(len(working))}

    if chart_type == "line":
        if not (is_numeric_dtype(x_series) or is_datetime64_any_dtype(x_series) or column_kind(x_series, x) == "datetime"):
            raise HTTPException(status_code=422, detail="A line chart requires a numeric or date/time X-axis column.")
        working = working.sort_values(by=x)
        if len(working) > MAX_CHART_POINTS:
            stride = max(1, len(working) // MAX_CHART_POINTS)
            working = working.iloc[::stride].head(MAX_CHART_POINTS)
        return {"chart_type": chart_type, "title": f"{y} over {x}", "x_key": "x", "y_key": "y", "data": [{"x": str(a), "y": float(b)} for a, b in working.itertuples(index=False, name=None)], "sample_count": int(len(working))}

    raise HTTPException(status_code=422, detail="Unsupported chart type.")


def create_chart_run(db: Session, dataset: DatasetSession, df: pd.DataFrame, request: ChartRequest) -> dict:
    chart_data = generate_chart_data(df, request)
    run_id = str(uuid.uuid4())
    config = request.model_dump()
    run = ChartRun(id=run_id, dataset_id=dataset.id, chart_type=request.chart_type, config_json=json_safe(config), chart_data_json=json_safe(chart_data), data_revision=dataset.data_revision)
    db.add(run)
    db.commit()
    return {"chart_run_id": run_id, **chart_data}
