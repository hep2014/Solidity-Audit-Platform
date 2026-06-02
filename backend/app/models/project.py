import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    file_path = Column(Text, nullable=False)

    # Release-grade project workspace fields.
    root_path = Column(Text, nullable=True)
    entrypoint_path = Column(Text, nullable=True)

    project_type = Column(String(50), nullable=False, default="single_file")
    solidity_files_count = Column(Integer, nullable=False, default=0)

    detected_solc_versions = Column(JSON, nullable=True)

    project_metadata = Column("metadata", JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship(
        "Analysis",
        back_populates="project",
        cascade="all, delete-orphan",
    )