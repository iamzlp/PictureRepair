import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.tasks import process_generation_task
from app.db.session import get_db
from app.models.billing import CreditTransaction
from app.models.task import GenerationTask
from app.models.user import User
from app.schemas import ArtStyle, ExportResponse, RepairMode, RepairTaskCreate, RepairTaskResponse, TaskStatus

router = APIRouter()


def build_repair_prompt(mode: RepairMode, extra_prompt: str | None = None) -> str:
    prompts = {
        RepairMode.COLORIZE: (
            "如果是翻拍照片，修复照片方向，去除轮廓外的其他元素，仅剩照片主体，以自然、符合历史且逼真的方式为这张老黑白照片上色，然后把这张老照片做高清修复，去除画面里的划痕、折痕、污点和明显噪点，尽量还原人物面部的清晰细节。"
            "请保留原照片的年代感和真实质感，不要把人物修成现代美颜风，不要过度磨皮，整体画面要自然、柔和、干净。"
            "把人物皮肤和整体色调处理得更自然一点，保留老照片的年代感，不要改变人物原本五官。重点优化人物面部清晰度，增强眼睛、鼻子、嘴巴和头发边缘的细节，但不要改变人物长相。"
        ),
        RepairMode.ENHANCE: (
            "如果是翻拍照片，修复照片方向，去除轮廓外的其他元素，仅剩照片主体，帮我把这张老照片做高清修复，去除画面里的划痕、折痕、污点和明显噪点，尽量还原人物面部的清晰细节。"
            "请保留原照片的年代感和真实质感，不要把人物修成现代美颜风，不要过度磨皮，整体画面要自然、柔和、干净。"
            "把人物皮肤和整体色调处理得更自然一点，保留老照片的年代感，不要改变人物原本五官。重点优化人物面部清晰度，增强眼睛、鼻子、嘴巴和头发边缘的细节，但不要改变人物长相。"
        ),
    }
    prompt = prompts[mode]
    if extra_prompt:
        prompt = f"{prompt} Additional instruction: {extra_prompt.strip()}"
    return prompt


@router.post("/tasks", response_model=RepairTaskResponse, response_model_by_alias=False)
async def create_repair_task(
    request: RepairTaskCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if not request.image_url.strip():
        raise HTTPException(status_code=422, detail="image_url is required")

    prompt = build_repair_prompt(request.mode, request.extra_prompt)
    task = GenerationTask(
        user_id=current_user.id,
        prompt=prompt,
        task_type=f"old_photo_{request.mode.value}",
        style=ArtStyle.REALISTIC,
        aspect_ratio=request.aspect_ratio,
        reference_image_url=request.image_url.strip(),
        prompt_trace=json.dumps(
            {
                "repair_mode": request.mode.value,
                "reference_image_urls": [request.image_url.strip()],
            },
            ensure_ascii=False,
        ),
        status=TaskStatus.PENDING,
        progress=0,
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)

    background_tasks.add_task(process_generation_task, str(task.id))

    return RepairTaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress or 0,
        task_type=task.task_type,
        reference_image_url=task.reference_image_url,
        created_at=task.created_at,
        mode=request.mode,
    )


@router.get("/tasks/{task_id}", response_model=RepairTaskResponse, response_model_by_alias=False)
async def get_repair_task(
    task_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(GenerationTask).where(
            GenerationTask.id == task_id,
            GenerationTask.user_id == current_user.id,
        )
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Repair task not found")

    mode = None
    if task.task_type == "old_photo_colorize":
        mode = RepairMode.COLORIZE
    elif task.task_type == "old_photo_enhance":
        mode = RepairMode.ENHANCE

    return RepairTaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress or 0,
        task_type=task.task_type,
        reference_image_url=task.reference_image_url,
        result_url=task.result_url,
        error_message=task.error_message,
        created_at=task.created_at,
        mode=mode,
    )


@router.post("/tasks/{task_id}/export", response_model=ExportResponse)
async def export_repair_result(
    task_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(GenerationTask).where(
            GenerationTask.id == task_id,
            GenerationTask.user_id == current_user.id,
        )
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Repair task not found")
    if task.status != TaskStatus.COMPLETED or not task.result_url:
        raise HTTPException(status_code=409, detail="Repair task is not completed")

    existing_export = await db.execute(
        select(CreditTransaction).where(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.transaction_type == "export",
            CreditTransaction.reference_id == task.id,
        )
    )
    existing_transaction = existing_export.scalars().first()
    if existing_transaction:
        return ExportResponse(
            task_id=task.id,
            result_url=task.result_url,
            balance=current_user.mileage_balance or 0,
            charged=False,
            transaction_id=existing_transaction.id,
        )

    if (current_user.mileage_balance or 0) < 1:
        raise HTTPException(status_code=402, detail="Insufficient photo credits")

    current_user.mileage_balance -= 1
    transaction = CreditTransaction(
        user_id=current_user.id,
        change=-1,
        balance_after=current_user.mileage_balance,
        transaction_type="export",
        reference_id=task.id,
        description="Export repaired photo",
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(current_user)
    await db.refresh(transaction)

    return ExportResponse(
        task_id=task.id,
        result_url=task.result_url,
        balance=current_user.mileage_balance,
        charged=True,
        transaction_id=transaction.id,
    )
