from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FeedbackCreateRequest(BaseModel):
    feedback_type: str = Field(..., min_length=1, max_length=50)
    content: str = Field(..., min_length=1, max_length=2000)
    page_path: Optional[str] = Field(default=None, max_length=255)


class FeedbackResponse(BaseModel):
    id: str
    user_id: str
    feedback_type: str
    content: str
    status: str
    source: str
    page_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
