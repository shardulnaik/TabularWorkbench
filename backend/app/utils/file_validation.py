from __future__ import annotations

from io import BytesIO
from pathlib import PurePath
import zipfile

import pandas as pd
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}


def safe_filename(filename: str | None) -> str:
    name = PurePath((filename or "upload").replace("\\", "/")).name
    name = "".join(ch for ch in name if ch.isalnum() or ch in {".", "_", "-", " "}).strip(" .")
    return (name or "upload")[:200]


def validate_file_bytes(filename: str | None, content: bytes, max_bytes: int) -> str:
    ext = PurePath((filename or "").lower()).suffix
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload a CSV or XLSX file only.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"The file exceeds the {max_bytes // (1024 * 1024)} MB upload limit.")
    if ext == ".xlsx":
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                members = archive.infolist()
                if len(members) > 5000:
                    raise HTTPException(status_code=400, detail="This workbook contains too many internal files.")
                total_uncompressed = sum(item.file_size for item in members)
                if total_uncompressed > max_bytes * 20:
                    raise HTTPException(status_code=413, detail="The expanded workbook is too large to process safely.")
                if "[Content_Types].xml" not in archive.namelist() or "xl/workbook.xml" not in archive.namelist():
                    raise HTTPException(status_code=400, detail="The XLSX file is not a valid Excel workbook.")
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=400, detail="The XLSX file is corrupted or invalid.") from exc
    return ext


def read_dataframe(content: bytes, extension: str, sheet_name: str | None = None) -> tuple[pd.DataFrame, list[str]]:
    try:
        if extension == ".csv":
            try:
                df = pd.read_csv(BytesIO(content), encoding="utf-8-sig", low_memory=False)
            except UnicodeDecodeError:
                df = pd.read_csv(BytesIO(content), encoding="cp1252", low_memory=False)
            sheets: list[str] = []
        else:
            workbook = pd.ExcelFile(BytesIO(content), engine="openpyxl")
            sheets = workbook.sheet_names
            if not sheets:
                raise HTTPException(status_code=400, detail="The workbook does not contain any worksheets.")
            selected = sheet_name if sheet_name in sheets else sheets[0]
            if sheet_name and sheet_name not in sheets:
                raise HTTPException(status_code=400, detail="The selected worksheet does not exist in this workbook.")
            df = pd.read_excel(workbook, sheet_name=selected, engine="openpyxl")
    except HTTPException:
        raise
    except (ValueError, UnicodeDecodeError, pd.errors.ParserError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read this file: {str(exc)[:240]}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse the uploaded file ({type(exc).__name__}).") from exc

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="The selected sheet contains no tabular data.")
    if len(df.columns) > 500:
        raise HTTPException(status_code=413, detail="This file contains more than 500 columns, which exceeds the current limit.")
    if len(df) > 500_000:
        raise HTTPException(status_code=413, detail="This file contains more than 500,000 rows, which exceeds the current limit.")
    if int(df.shape[0]) * int(df.shape[1]) > 2_000_000:
        raise HTTPException(status_code=413, detail="This dataset contains more than 2 million cells, which exceeds the current processing limit.")

    df.columns = [str(c).strip() if str(c).strip() else f"Unnamed_{i + 1}" for i, c in enumerate(df.columns)]
    if df.columns.duplicated().any():
        raise HTTPException(status_code=400, detail="Column names must be unique. Rename duplicate columns and upload again.")
    return df, sheets
