from __future__ import annotations

import re

import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_datetime64_any_dtype, is_numeric_dtype

ID_NAME_PATTERN = re.compile(r"(^id$|_id$|\bid\b|roll.?no|student.?no|employee.?no|record.?no|email|phone|mobile|telephone|ssn|social.?security|passport|account.?number|customer.?number|postal.?code|zip.?code)", re.I)


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
    # Near-unique numeric measures (salary, age, scores, etc.) are often valid
    # prediction inputs/targets. Infer unnamed identifiers from unique text only.
    return bool(name_suggests_id and unique_ratio >= 0.5) or bool(not is_numeric_dtype(series.dtype) and unique_ratio >= 0.98 and len(series) >= 20)


def is_measure_like(series: pd.Series, name: str) -> bool:
    """Avoid treating named numeric measures as identifiers just because they are mostly unique."""
    if not is_numeric_dtype(series.dtype):
        return False
    return any(token in name.lower() for token in ("salary", "income", "amount", "price", "score", "mark", "weight", "height", "revenue", "cost", "quantity", "balance"))


def detect_target_task(series: pd.Series) -> tuple[str, bool, str]:
    """Infer regression versus classification from observed values, not dtype alone."""
    values = series.dropna()
    if values.empty:
        raise ValueError("The target has no non-missing values.")
    if is_bool_dtype(values.dtype):
        return "classification", False, "Boolean target values represent classes."
    numeric = pd.to_numeric(values, errors="coerce")
    numeric_share = float(numeric.notna().mean())
    if numeric_share >= 0.95:
        numeric = numeric.dropna()
        unique_count = int(numeric.nunique())
        unique_ratio = unique_count / max(len(numeric), 1)
        integer_like = bool(np.all(np.isclose(numeric.to_numpy(dtype=float), np.round(numeric.to_numpy(dtype=float)))))
        discrete = unique_count <= 20 or (integer_like and unique_count <= 50 and unique_ratio <= 0.05)
        if discrete:
            return "classification", True, f"Numeric target has {unique_count} distinct values and appears discrete."
        return "regression", True, f"Numeric target has {unique_count} distinct values and appears continuous."
    return "classification", False, "Target values are categorical."
