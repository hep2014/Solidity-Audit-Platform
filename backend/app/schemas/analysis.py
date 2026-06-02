from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FindingRead(BaseModel):
    id: UUID
    severity: str
    rule: str
    message: str

    file_path: str | None = None

    line: int | None = None
    column: int | None = None
    end_line: int | None = None

    tool: str

    confidence: str | None = None
    description: str | None = None
    recommendation: str | None = None
    references: list[str] | dict | None = None

    fingerprint: str

    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisRead(BaseModel):
    id: UUID
    project_id: UUID
    celery_task_id: str | None = None
    status: str
    progress: int
    current_step: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

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