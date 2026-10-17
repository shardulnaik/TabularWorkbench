from __future__ import annotations

import pandas as pd

from app.services.profiling_service import profile_dataframe


def build_eda_summary(df: pd.DataFrame) -> dict:
    profile = profile_dataframe(df)
    return {
        "row_count": profile["row_count"],
        "column_count": profile["column_count"],
        "numeric_summary": profile["numeric_summary"],
        "category_summary": profile["category_summary"],
        "missing_cells": profile["missing_cells"],
        "duplicate_rows": profile["duplicate_rows"],
        "correlation": df.select_dtypes(include="number").corr(numeric_only=True).round(4).fillna(0).to_dict(),
    }
