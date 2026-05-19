from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PhotoBase(BaseModel):
    url: str
    category: str = "default"

class PhotoCreate(PhotoBase):
    filename: str

class PhotoResponse(PhotoBase):
    id: str
    filename: str
    created_at: datetime

    model_config = {"from_attributes": True}
