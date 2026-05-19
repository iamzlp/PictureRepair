from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.task import AspectRatio, GenerationTaskResponse


class RepairMode(str, Enum):
    COLORIZE = "colorize"
    ENHANCE = "enhance"


class RepairTaskCreate(BaseModel):
    image_url: str = Field(..., description="Uploaded source photo URL")
    mode: RepairMode = Field(..., description="Old photo repair mode")
    aspect_ratio: AspectRatio = Field(default=AspectRatio.PORTRAIT)
    extra_prompt: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional extra user instruction",
    )


class RepairTaskResponse(GenerationTaskResponse):
    mode: Optional[RepairMode] = None
