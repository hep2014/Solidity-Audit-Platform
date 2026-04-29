import uuid

from sqlalchemy import Column, String, Integer, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(String(50), nullable=False, default="PENDING")
    progress = Column(Integer, nullable=False, default=0)
    current_step = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

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