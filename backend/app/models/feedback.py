import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db.base_class import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    feedback_type = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="submitted", index=True)
    source = Column(String, nullable=False, default="miniprogram")
    page_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
