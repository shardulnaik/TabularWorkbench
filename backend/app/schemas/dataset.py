from pydantic import BaseModel, Field


class DatasetSummary(BaseModel):
    session_id: str
    filename: str
    row_count: int
    column_count: int
    selected_sheet: str | None = None
    data_revision: int
    expires_at: str
    profile: dict
    cleaning_plan: dict


class SheetSelectionResponse(BaseModel):
    requires_sheet_selection: bool = True
    available_sheets: list[str]
    message: str
