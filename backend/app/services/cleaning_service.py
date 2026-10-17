from __future__ import annotations

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.db.models import CleaningLog, DatasetSession
from app.services.profiling_service import profile_dataframe
from app.storage.local_artifacts import artifact_store


ACTION_CATALOG = {
    "trim_whitespace": {"title": "Trim extra spaces in text cells", "description": "Remove whitespace at the beginning and end of text values.", "recommended": True},
    "normalize_blank_strings": {"title": "Treat blank text as missing", "description": "Convert empty strings and whitespace-only cells into missing values.", "recommended": True},
    "remove_duplicates": {"title": "Remove exact duplicate rows", "description": "Keep the first occurrence of each identical row. Review whether duplicates represent legitimate repeated events.", "recommended": False},
    "impute_missing": {"title": "Fill missing feature values", "description": "Optional imputation can alter target labels. Leave unchecked if you may predict a column with missing labels; the ML workflow otherwise excludes missing target rows.", "recommended": False},
}


def build_cleaning_plan(df: pd.DataFrame) -> dict:
    text_columns = list(df.select_dtypes(include=["object", "string"]).columns)
    trimmed_cells = 0
    blank_cells = 0
    for column in text_columns:
        values = df[column].dropna().astype(str)
        trimmed_cells += int((values != values.str.strip()).sum())
        blank_cells += int(values.str.strip().eq("").sum())
    missing_cells = int(df.isna().sum().sum()) + blank_cells
    duplicates = int(df.duplicated().sum())
    actions = []
    for action_id, meta in ACTION_CATALOG.items():
        if action_id == "trim_whitespace":
            count = trimmed_cells
        elif action_id == "normalize_blank_strings":
            count = blank_cells
        elif action_id == "remove_duplicates":
            count = duplicates
        else:
            count = missing_cells
        available = count > 0
        actions.append({"id": action_id, **meta, "estimated_cells_or_rows": int(count), "available": available})
    return {"actions": actions, "recommended_action_ids": [a["id"] for a in actions if a["recommended"] and a["available"]], "note": "Only selected actions will run. The original uploaded dataset is preserved separately."}


def apply_cleaning_actions(db: Session, dataset: DatasetSession, action_ids: list[str]) -> dict:
    unknown = set(action_ids) - set(ACTION_CATALOG)
    if unknown:
        raise ValueError(f"Unsupported cleaning action(s): {', '.join(sorted(unknown))}")
    df = artifact_store.load_dataframe(dataset.cleaned_dataframe_path)
    if not action_ids:
        return {"profile": profile_dataframe(df), "cleaning_log": [], "data_revision": dataset.data_revision, "actions_applied": []}
    logs: list[dict] = []
    for action_id in action_ids:
        before_rows = len(df)
        if action_id == "trim_whitespace":
            changed = 0
            for column in df.select_dtypes(include=["object", "string"]).columns:
                series = df[column]
                values = series.astype("string")
                changed += int(((values != values.str.strip()) & values.notna()).sum())
                df[column] = values.str.strip().where(values.notna(), series)
            affected = changed
            details = {"cells_changed": changed}
        elif action_id == "normalize_blank_strings":
            changed = 0
            for column in df.select_dtypes(include=["object", "string"]).columns:
                series = df[column]
                blank_mask = series.astype("string").str.strip().eq("").fillna(False)
                changed += int(blank_mask.sum())
                df.loc[blank_mask, column] = np.nan
            affected = changed
            details = {"cells_changed": changed}
        elif action_id == "remove_duplicates":
            before = len(df)
            df = df.drop_duplicates(keep="first").reset_index(drop=True)
            affected = before - len(df)
            details = {"rows_removed": affected, "policy": "keep_first"}
        elif action_id == "impute_missing":
            changed = 0
            columns_filled: dict[str, dict] = {}
            for column in df.columns:
                missing_before = int(df[column].isna().sum())
                if not missing_before:
                    continue
                series = df[column]
                if pd.api.types.is_numeric_dtype(series):
                    median = series.median()
                    if pd.isna(median):
                        continue
                    df[column] = series.fillna(median)
                    columns_filled[str(column)] = {"strategy": "median", "value": float(median), "count": missing_before}
                    changed += missing_before
                elif pd.api.types.is_bool_dtype(series):
                    df[column] = series.fillna(False)
                    columns_filled[str(column)] = {"strategy": "constant_false", "count": missing_before}
                    changed += missing_before
                else:
                    df[column] = series.astype("object").where(series.notna(), "Missing")
                    columns_filled[str(column)] = {"strategy": "constant_missing", "value": "Missing", "count": missing_before}
                    changed += missing_before
            affected = changed
            details = {"cells_filled": changed, "columns": columns_filled, "warning": "Do not impute missing target labels for supervised ML; select the target and exclude its missing labels at training time."}
        else:
            continue
        meta = ACTION_CATALOG[action_id]
        db.add(CleaningLog(dataset_id=dataset.id, action_id=action_id, title=meta["title"], rows_affected=int(affected), details_json=details))
        logs.append({"action_id": action_id, "title": meta["title"], "rows_affected": int(affected), "details": details, "row_count_before": before_rows, "row_count_after": int(len(df))})

    stored_path = artifact_store.save_dataframe(dataset.id, "cleaned_dataframe.pkl", df)
    dataset.cleaned_dataframe_path = str(stored_path)
    dataset.row_count = int(len(df))
    dataset.column_count = int(len(df.columns))
    dataset.data_revision += 1
    dataset.cleaning_applied = True
    db.add(dataset)
    db.commit()
    return {"profile": profile_dataframe(df), "cleaning_log": logs, "data_revision": dataset.data_revision, "actions_applied": action_ids}


def get_cleaning_log(db: Session, dataset_id: str) -> list[dict]:
    rows = db.query(CleaningLog).filter(CleaningLog.dataset_id == dataset_id).order_by(CleaningLog.id.asc()).all()
    return [{"id": row.id, "action_id": row.action_id, "title": row.title, "rows_affected": row.rows_affected, "details": row.details_json, "created_at": row.created_at.isoformat()} for row in rows]
