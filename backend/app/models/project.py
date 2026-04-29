import uuid

from sqlalchemy import Column, String, Text, DateTime, func, ForeignKey
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
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    file_path = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship(
        "Analysis",
        back_populates="project",
        cascade="all, delete-orphan",
    )