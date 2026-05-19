from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
from app.schemas.route import Route, BatchGenerationRequest, BatchGenerationResponse
from app.api.v1.endpoints.routes_data import FEATURED_ROUTES
from app.models.task import GenerationTask
from app.models.user import User
from app.schemas.task import TaskStatus, AspectRatio
from app.api import deps
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.endpoints.tasks import process_generation_task
import uuid

router = APIRouter()

@router.get("/", response_model=List[Route])
async def list_routes():
    return FEATURED_ROUTES

@router.get("/{route_id}", response_model=Route)
async def get_route(route_id: str):
    for route in FEATURED_ROUTES:
        if route.id == route_id:
            return route
    raise HTTPException(status_code=404, detail="Route not found")

@router.post("/{route_id}/generate", response_model=BatchGenerationResponse)
async def generate_route(
    route_id: str,
    request: BatchGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Find Route
    route = next((r for r in FEATURED_ROUTES if r.id == route_id), None)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    # 2. Create Batch ID
    batch_id = str(uuid.uuid4())
    task_ids = []

    # 3. Create Tasks for each Stop
    for stop in route.stops:
        # Construct Prompt
        # Append style and character consistency hint
        prompt = stop.prompt_template
        
        # If user uploaded a photo, we pass it as reference_image_url
        # And maybe add "same person" to prompt?
        
        new_task = GenerationTask(
            user_id=current_user.id,
            batch_id=batch_id,
            prompt=prompt,
            style=request.style or route.default_style, # Use request style or default
            aspect_ratio=AspectRatio.PORTRAIT, # Default portrait for travel photos
            reference_image_url=request.reference_photo_url,
            status=TaskStatus.PENDING
        )
        
        db.add(new_task)
        await db.commit()
        await db.refresh(new_task)
        
        task_ids.append(new_task.id)
        
        # Trigger background processing for each task
        background_tasks.add_task(process_generation_task, str(new_task.id))

    return BatchGenerationResponse(
        batch_id=batch_id,
        task_ids=task_ids,
        message="Route generation started"
    )
