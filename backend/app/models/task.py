from sqlalchemy import Column, String, Integer, Enum as SQLEnum, DateTime, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.db.base_class import Base
from app.schemas import TaskStatus, ArtStyle, AspectRatio

def generate_uuid():
    return str(uuid.uuid4())

class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    # Allow null for existing tasks, but new tasks should have it
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    # Group multiple tasks into one itinerary/route generation
    batch_id = Column(String, nullable=True, index=True)

    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    
    # User Input
    prompt = Column(String, nullable=False)
    task_type = Column(String, nullable=True, index=True)
    prompt_options = Column(String, nullable=True)
    prompt_version = Column(String, nullable=True)
    assembled_prompt = Column(String, nullable=True)
    prompt_engine_status = Column(String, nullable=True)
    prompt_trace = Column(String, nullable=True)
    style = Column(SQLEnum(ArtStyle), nullable=False)
    aspect_ratio = Column(SQLEnum(AspectRatio), nullable=False)
    reference_image_url = Column(String, nullable=True)

    # Result
    result_url = Column(String, nullable=True)
    result_video_url = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    video_status = Column(String, nullable=True, index=True)
    video_progress = Column(Integer, default=0)
    video_error_message = Column(String, nullable=True)
    video_prompt = Column(String, nullable=True)

    # External API Info
    external_task_id = Column(String, nullable=True)
    video_external_task_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
