import uuid

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tool = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)

    exit_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("Analysis", back_populates="logs")