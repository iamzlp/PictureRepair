from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import asyncio
import traceback
import json

from app.schemas import GenerationRequest, GenerationTaskResponse, TaskStatus
from app.core.config import settings
from app.db.session import get_db, async_session_factory
from app.models.task import GenerationTask
from app.models.user import User
from app.services.volc_adapter import volc_adapter
from app.services.storage import storage_manager
from app.api import deps

router = APIRouter()

# -------------------------------------------------------------------
# Real Worker (Volcengine + Storage)
# -------------------------------------------------------------------
async def process_generation_task(task_id: str):
    """
    Background task to handle image generation:
    1. Update status to PROCESSING
    2. Call Volcengine API
    3. Upload result to storage (MinIO/OSS)
    4. Update status to COMPLETED and save URL
    """
    # Create a new session for the background task
    async with async_session_factory() as db:
        result = await db.execute(select(GenerationTask).where(GenerationTask.id == task_id))
        task = result.scalars().first()
        
        if not task:
            return

        try:
            # 1. Update Status -> PROCESSING
            task.status = TaskStatus.PROCESSING
            task.progress = 10
            await db.commit()

            # 2. Call Volcengine API
            # This is a synchronous call, might block event loop slightly, but acceptable for MVP
            # In production, run in thread pool or Celery
            style_value = task.style.value if hasattr(task.style, "value") else str(task.style)
            reference_urls = []
            if task.prompt_trace:
                try:
                    trace_data = json.loads(task.prompt_trace)
                    trace_urls = trace_data.get("reference_image_urls")
                    if isinstance(trace_urls, list):
                        reference_urls = [str(u).strip() for u in trace_urls if str(u).strip()]
                except Exception:
                    reference_urls = []
            if not reference_urls and task.reference_image_url:
                reference_urls = [task.reference_image_url]

            if settings.MOCK_IMAGE_GENERATION:
                await asyncio.sleep(1)
                task.progress = 55
                await db.commit()

                await asyncio.sleep(1)
                task.status = TaskStatus.COMPLETED
                task.progress = 100
                task.result_url = reference_urls[0] if reference_urls else task.reference_image_url
                if not task.result_url:
                    task.error_message = "MOCK_IMAGE_GENERATION requires a reference image URL"
                    task.status = TaskStatus.FAILED
                await db.commit()
                return

            image_data = await asyncio.to_thread(
                volc_adapter.generate_image,
                prompt=task.prompt,
                style=style_value,
                aspect_ratio=task.aspect_ratio,
                reference_image_urls=reference_urls
            )
            
            task.progress = 80
            await db.commit()

            # 3. Upload result to storage
            # Also sync, run in thread
            image_url = await asyncio.to_thread(
                storage_manager.upload_image,
                image_data=image_data
            )

            # 4. Update Status -> COMPLETED
            task.status = TaskStatus.COMPLETED
            task.progress = 100
            task.result_url = image_url
            await db.commit()

        except Exception as e:
            print(f"Task {task_id} failed: {e}")
            traceback.print_exc()
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            await db.commit()

# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------

@router.post("/", response_model=GenerationTaskResponse, response_model_by_alias=False)
async def create_task(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new generation task.
    """
    print(f"[Create Task Request] prompt={request.prompt}, style={request.style}, aspect_ratio={request.aspect_ratio}")
    print(f"[Create Task Request] reference_image_url={request.reference_image_url}")
    print(f"[Create Task Request] reference_image_urls={request.reference_image_urls}")
    
    reference_urls = []
    if request.reference_image_urls:
        reference_urls = [str(url).strip() for url in request.reference_image_urls if str(url).strip()]
    if request.reference_image_url and request.reference_image_url.strip():
        if request.reference_image_url.strip() not in reference_urls:
            reference_urls.insert(0, request.reference_image_url.strip())
    print(f"[Create Task Processed] final reference_urls={reference_urls}")
    if len(reference_urls) > 4:
        raise HTTPException(status_code=422, detail="reference_image_urls 最多支持 4 张")
    new_task = GenerationTask(
        user_id=current_user.id,
        prompt=request.prompt,
        style=request.style,
        aspect_ratio=request.aspect_ratio,
        reference_image_url=reference_urls[0] if reference_urls else None,
        prompt_trace=json.dumps({"reference_image_urls": reference_urls}, ensure_ascii=False),
        status=TaskStatus.PENDING
    )
    
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    # Trigger background task
    background_tasks.add_task(process_generation_task, str(new_task.id))
    
    return GenerationTaskResponse(
        task_id=new_task.id,
        status=new_task.status,
        progress=0,
        task_type=new_task.task_type,
        reference_image_url=new_task.reference_image_url,
        created_at=new_task.created_at
    )

@router.get("/", response_model=List[GenerationTaskResponse], response_model_by_alias=False)
async def list_tasks(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20
) -> Any:
    """
    List user's tasks.
    """
    result = await db.execute(
        select(GenerationTask)
        .where(GenerationTask.user_id == current_user.id)
        .order_by(GenerationTask.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    tasks = result.scalars().all()
    
    # Manually map to response model to avoid Pydantic alias issues with ORM
    return [
        GenerationTaskResponse(
            task_id=t.id,
            status=t.status,
            progress=t.progress,
            task_type=t.task_type,
            reference_image_url=t.reference_image_url,
            result_url=t.result_url,
            error_message=t.error_message,
            created_at=t.created_at
        ) for t in tasks
    ]

@router.get("/{task_id}", response_model=GenerationTaskResponse, response_model_by_alias=False)
async def get_task_status(
    task_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get task status.
    """
    result = await db.execute(select(GenerationTask).where(GenerationTask.id == task_id))
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return GenerationTaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        task_type=task.task_type,
        reference_image_url=task.reference_image_url,
        result_url=task.result_url,
        error_message=task.error_message,
        created_at=task.created_at
    )
