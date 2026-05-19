from typing import List, Optional
from pydantic import BaseModel
from .task import ArtStyle

class RouteStop(BaseModel):
    id: str
    name: str
    description: str
    prompt_template: str
    cover_url: Optional[str] = None

class Route(BaseModel):
    id: str
    title: str
    description: str
    cover_url: str
    days: int
    stops: List[RouteStop]
    default_style: ArtStyle = ArtStyle.REALISTIC

class BatchGenerationRequest(BaseModel):
    route_id: str
    reference_photo_url: Optional[str] = None
    style: ArtStyle = ArtStyle.REALISTIC

class BatchGenerationResponse(BaseModel):
    batch_id: str
    task_ids: List[str]
    message: str
