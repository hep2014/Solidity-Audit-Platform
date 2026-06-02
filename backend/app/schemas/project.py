from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProjectRead(BaseModel):
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

    class Config:
        from_attributes = True