import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.enums import FindingSeverity


class Finding(Base):
    __tablename__ = "findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    severity = Column(
        String(50),
        nullable=False,
        default=FindingSeverity.INFO.value,
        index=True,
    )

    rule = Column(String(150), nullable=False, index=True)
    message = Column(Text, nullable=False)

    file_path = Column(Text, nullable=True)

    line = Column(Integer, nullable=True)
    column = Column(Integer, nullable=True)
    end_line = Column(Integer, nullable=True)

    tool = Column(String(100), nullable=False, default="basic-scanner", index=True)

    confidence = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    references = Column(JSONB, nullable=True)

    fingerprint = Column(String(128), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("Analysis", back_populates="findings")

    __table_args__ = (
        UniqueConstraint(
            "analysis_id",
            "fingerprint",
            name="uq_findings_analysis_fingerprint",
        ),
    )