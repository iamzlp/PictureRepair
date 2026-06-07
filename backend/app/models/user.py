from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base # Changed from app.db.base
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    openid = Column(String, unique=True, index=True, nullable=True)
    unionid = Column(String, nullable=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    nickname = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    mileage_balance = Column(Integer, default=2) # Default credits for new users
    created_at = Column(DateTime(timezone=True), server_default=func.now())
