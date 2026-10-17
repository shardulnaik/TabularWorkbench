from pydantic import BaseModel


class ExportInfo(BaseModel):
    name: str
    available: bool
    description: str
