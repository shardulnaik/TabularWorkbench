from __future__ import annotations

import re

import pandas as pd
from pandas.api.types import is_bool_dtype, is_datetime64_any_dtype, is_numeric_dtype

ID_NAME_PATTERN = re.compile(r"(^id$|_id$|\bid\b|roll.?no|student.?no|employee.?no|record.?no|email)", re.I)


def column_kind(series: pd.Series, name: str = "") -> str:
    if is_bool_dtype(series.dtype):
        return "boolean"
    if is_numeric_dtype(series.dtype):
        return "numeric"
    if is_datetime64_any_dtype(series.dtype):
        return "datetime"
    # Attempt datetime recognition only for date-like column names and strings.
    if re.search(r"date|timestamp|datetime|(^|[_\s-])time([_\s-]|$)|_at$", name, re.I) and series.notna().any():
        parsed = pd.to_datetime(series.dropna().astype(str).head(100), errors="coerce")
        if len(parsed) and parsed.notna().mean() >= 0.8:
            return "datetime"
    return "categorical"


def is_id_like(series: pd.Series, name: str) -> bool:
    if len(series) == 0:
        return False
    unique_ratio = series.nunique(dropna=True) / max(int(series.notna().sum()), 1)
    name_suggests_id = bool(ID_NAME_PATTERN.search(name.replace(" ", "_")))
    return bool(name_suggests_id and unique_ratio >= 0.5) or bool(unique_ratio >= 0.98 and len(series) >= 20)
