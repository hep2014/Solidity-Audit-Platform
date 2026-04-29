import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    telegram_chat_id = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())