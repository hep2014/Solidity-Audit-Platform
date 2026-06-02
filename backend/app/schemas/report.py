from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.analysis import AnalysisLogRead, FindingRead


class ReportAnalysis(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    progress: int
    current_step: str | None = None
    celery_task_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class ReportProject(BaseModel):
    id: UUID
    name: str
    description: str | None = None

    file_path: str
    root_path: str | None = None
    entrypoint_path: str | None = None
    project_type: str
    solidity_files_count: int
    detected_solc_versions: list[str] | None = None
    project_metadata: dict | None = None

    created_at: datetime

class ReportSummary(BaseModel):
    total: int
    by_severity: dict[str, int]
    by_tool: dict[str, int]


class AnalysisReport(BaseModel):
    analysis: ReportAnalysis
    project: ReportProject
    summary: ReportSummary
    findings: list[FindingRead]
    logs: list[AnalysisLogRead]