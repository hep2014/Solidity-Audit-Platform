from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FindingRead(BaseModel):
    id: UUID
    severity: str
    rule: str
    message: str
    line: int | None = None
    tool: str
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisRead(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    progress: int
    current_step: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class AnalysisLogRead(BaseModel):
    id: UUID
    analysis_id: UUID
    tool: str
    status: str
    exit_code: int | None = None
    duration_ms: int | None = None
    stdout: str | None = None
    stderr: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True