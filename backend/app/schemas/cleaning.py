from pydantic import BaseModel, Field


class CleaningApplyRequest(BaseModel):
    actions: list[str] = Field(default_factory=list, max_length=20)
