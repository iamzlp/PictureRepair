from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class Photo(Base):
    __tablename__ = "photos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    url = Column(String, nullable=False) # MinIO URL
    filename = Column(String, nullable=False) # Original filename
    category = Column(String, default="default") # e.g. portrait, full_body
    created_at = Column(DateTime(timezone=True), server_default=func.now())
