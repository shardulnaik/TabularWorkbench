from __future__ import annotations

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype

from app.utils.data_types import column_kind, is_id_like
from app.utils.serialization import json_safe


def profile_dataframe(df: pd.DataFrame) -> dict:
    if not isinstance(df, pd.DataFrame):
        raise TypeError("profile_dataframe expects a DataFrame")
    total_cells = int(df.shape[0] * df.shape[1])
    missing_total = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    columns: list[dict] = []
    numeric_summary: dict[str, dict] = {}
    category_summary: dict[str, list[dict]] = {}
    warnings: list[dict] = []
    numeric_count = categorical_count = datetime_count = boolean_count = 0

    for name in df.columns:
        series = df[name]
        kind = column_kind(series, str(name))
        missing = int(series.isna().sum())
        missing_pct = (missing / max(len(df), 1)) * 100
        unique_count = int(series.nunique(dropna=True))
        id_like = is_id_like(series, str(name))
        if kind == "numeric":
            numeric_count += 1
            numeric_summary[str(name)] = json_safe({
                "count": int(series.count()),
                "mean": series.mean(),
                "median": series.median(),
                "std": series.std(),
                "min": series.min(),
                "max": series.max(),
            })
            lower_name = str(name).lower()
            if any(token in lower_name for token in ("age", "year", "month", "amount", "income", "salary", "price", "mark", "score", "quantity")):
                suspicious = int((series.dropna() < 0).sum())
                if suspicious:
                    warnings.append({"level": "warning", "code": "negative_values", "column": str(name), "count": suspicious, "message": f"{suspicious} negative value(s) found in {name}; review whether they are valid."})
        elif kind == "datetime":
            datetime_count += 1
        elif kind == "boolean":
            boolean_count += 1
        else:
            categorical_count += 1
            top = series.astype("string").fillna("(Missing)").value_counts(dropna=False).head(10)
            category_summary[str(name)] = [{"value": str(k), "count": int(v)} for k, v in top.items()]
        nonmissing = series.dropna()
        samples = [str(v)[:120] for v in nonmissing.head(4).tolist()]
        columns.append({
            "name": str(name), "kind": kind, "dtype": str(series.dtype),
            "missing_count": missing, "missing_pct": round(missing_pct, 2),
            "unique_count": unique_count, "is_constant": unique_count <= 1,
            "is_id_like": id_like, "sample_values": samples,
        })
        if len(df) and missing_pct >= 80:
            warnings.append({"level": "warning", "code": "mostly_missing", "column": str(name), "count": missing, "message": f"{name} is missing {missing_pct:.1f}% of its values."})
        if id_like:
            warnings.append({"level": "info", "code": "id_like_column", "column": str(name), "count": unique_count, "message": f"{name} may be an identifier; review it before using it as a prediction feature."})
        if unique_count <= 1:
            warnings.append({"level": "info", "code": "constant_column", "column": str(name), "count": unique_count, "message": f"{name} has one or zero distinct non-missing values."})

    if duplicate_rows:
        warnings.append({"level": "warning", "code": "duplicate_rows", "column": None, "count": duplicate_rows, "message": f"Found {duplicate_rows} exact duplicate row(s). Review before removing; repeated records may be legitimate."})
    if missing_total:
        warnings.append({"level": "info", "code": "missing_values", "column": None, "count": missing_total, "message": f"{missing_total} missing cell(s) need attention."})

    health = "Good" if not warnings else ("Needs attention" if any(w["level"] == "warning" for w in warnings) else "Review recommended")
    preview = df.head(10).replace({np.nan: None}).to_dict(orient="records")
    preview = json_safe([{str(k): v for k, v in row.items()} for row in preview])
    return json_safe({
        "row_count": int(df.shape[0]), "column_count": int(df.shape[1]),
        "missing_cells": missing_total,
        "missing_percentage": round((missing_total / total_cells * 100) if total_cells else 0, 2),
        "duplicate_rows": duplicate_rows,
        "numeric_columns": numeric_count, "categorical_columns": categorical_count,
        "datetime_columns": datetime_count, "boolean_columns": boolean_count,
        "health_status": health, "warnings": warnings, "columns": columns,
        "numeric_summary": numeric_summary, "category_summary": category_summary,
        "preview": preview,
    })
