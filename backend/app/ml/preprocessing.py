from __future__ import annotations

import re

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.utils.data_types import column_kind, is_id_like


def prepare_ml_frame(df: pd.DataFrame, target_column: str) -> tuple[pd.DataFrame, pd.Series, list[int], list[str]]:
    """Create stable, leakage-conscious features and string classification labels."""
    if target_column not in df.columns:
        raise ValueError("Target column does not exist in the dataset")
    valid_positions = [int(i) for i, value in enumerate(df[target_column].tolist()) if pd.notna(value)]
    labelled = df.iloc[valid_positions].reset_index(drop=True)
    y = labelled[target_column].astype(str)
    features: dict[str, pd.Series] = {}
    excluded: list[str] = []
    for name in df.columns:
        if name == target_column:
            continue
        series = labelled[name]
        if series.isna().all() or series.nunique(dropna=True) <= 1:
            excluded.append(str(name))
            continue
        if is_id_like(series, str(name)):
            excluded.append(str(name))
            continue
        if column_kind(series, str(name)) == "datetime":
            dates = pd.to_datetime(series, errors="coerce")
            if dates.notna().mean() >= 0.8:
                safe_name = re.sub(r"[^A-Za-z0-9_]+", "_", str(name)).strip("_") or "date"
                features[f"{safe_name}__year"] = dates.dt.year.astype("float64")
                features[f"{safe_name}__month"] = dates.dt.month.astype("float64")
                features[f"{safe_name}__day"] = dates.dt.day.astype("float64")
                features[f"{safe_name}__dayofweek"] = dates.dt.dayofweek.astype("float64")
                excluded.append(f"{name} (converted into date parts)")
                continue
        features[str(name)] = series.reset_index(drop=True)
    if not features:
        raise ValueError("No usable feature columns remain after excluding the target, identifiers, and constant or empty columns.")
    X = pd.DataFrame(features)
    return X, y, valid_positions, excluded


def build_preprocessor(X: pd.DataFrame, scale_numeric: bool = True) -> ColumnTransformer:
    numeric_columns = list(X.select_dtypes(include=["number"]).columns)
    categorical_columns = [column for column in X.columns if column not in numeric_columns]
    transformers: list[tuple[str, Pipeline, list[str]]] = []
    if numeric_columns:
        numeric_steps = [("imputer", SimpleImputer(strategy="median", keep_empty_features=True))]
        if scale_numeric:
            numeric_steps.append(("scaler", StandardScaler()))
        transformers.append(("numeric", Pipeline(numeric_steps), numeric_columns))
    if categorical_columns:
        categorical_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="constant", fill_value="(Missing)", keep_empty_features=True)),
            ("encoder", OneHotEncoder(handle_unknown="ignore", min_frequency=0.01, max_categories=100)),
        ])
        transformers.append(("categorical", categorical_pipeline, categorical_columns))
    if not transformers:
        raise ValueError("No numeric or categorical features are available for preprocessing.")
    return ColumnTransformer(transformers=transformers, remainder="drop", verbose_feature_names_out=True)
