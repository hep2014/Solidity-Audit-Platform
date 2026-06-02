import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.enums import AnalysisStatus


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    celery_task_id = Column(String(255), nullable=True, index=True)

    status = Column(
        String(50),
        nullable=False,
        default=AnalysisStatus.PENDING.value,
        index=True,
    )
    progress = Column(Integer, nullable=False, default=0)
    current_step = Column(String(255), nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project = relationship("Project", back_populates="analyses")
    findings = relationship(
        "Finding",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )
    logs = relationship(
        "AnalysisLog",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )