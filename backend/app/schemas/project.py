from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True