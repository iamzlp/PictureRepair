import asyncio
import io
import json
from typing import Any

from PIL import Image
import requests

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.tasks import process_generation_task
from app.core.config import settings
from app.db.session import async_session_factory, get_db
from app.models.billing import CreditTransaction
from app.models.task import GenerationTask
from app.models.user import User
from app.schemas import ArtStyle, AspectRatio, ExportResponse, RepairMode, RepairTaskCreate, RepairTaskResponse, TaskStatus
from app.services.agnes_video_adapter import agnes_video_adapter
from app.services.storage import storage_manager

router = APIRouter()


def summarize_video_payload(payload: Any, limit: int = 2500) -> str:
    try:
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        text = str(payload)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...(truncated {len(text) - limit} chars)"


def collect_video_url_candidates(payload: Any) -> list[str]:
    candidates: list[str] = []

    def normalize_url(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = value.strip().strip("`").strip().strip('"').strip("'").strip()
        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            return cleaned
        return None

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                key_text = str(key).lower()
                if "video" in key_text or key_text in {"url", "uri", "file"}:
                    normalized = normalize_url(item)
                    if normalized:
                        candidates.append(normalized)
                    elif isinstance(item, list):
                        for sub_item in item:
                            normalized_sub_item = normalize_url(sub_item)
                            if normalized_sub_item:
                                candidates.append(normalized_sub_item)
                            elif isinstance(sub_item, dict):
                                visit(sub_item)
                    elif isinstance(item, dict):
                        visit(item)
                elif isinstance(item, (dict, list)):
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, (dict, list)):
                    visit(item)

    visit(payload)
    unique: list[str] = []
    for item in candidates:
        if item not in unique:
            unique.append(item)
    return unique[:10]


def extract_video_url(payload: Any) -> str:
    if isinstance(payload, dict):
        raw_url = payload.get("video_url")
        if isinstance(raw_url, str):
            normalized = raw_url.strip().strip("`").strip().strip('"').strip("'").strip()
            if normalized.startswith("http://") or normalized.startswith("https://"):
                return normalized
    candidate_urls = collect_video_url_candidates(payload)
    if candidate_urls:
        return candidate_urls[0]
    return ""


def serialize_repair_task(task: GenerationTask, mode: RepairMode | None = None) -> RepairTaskResponse:
    return RepairTaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress or 0,
        task_type=task.task_type,
        reference_image_url=storage_manager.resolve_public_url(task.reference_image_url, expires=900),
        result_url=storage_manager.resolve_public_url(task.result_url, expires=900),
        video_status=task.video_status,
        video_progress=task.video_progress or 0,
        result_video_url=storage_manager.resolve_public_url(task.result_video_url, expires=1800),
        video_error_message=task.video_error_message,
        error_message=task.error_message,
        created_at=task.created_at,
        mode=mode,
    )


def normalize_video_status(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"queued", "submitted", "pending"}:
        return "submitted"
    if normalized in {"processing", "running", "in_progress"}:
        return "processing"
    if normalized in {"completed", "success", "succeeded"}:
        return "completed"
    if normalized in {"failed", "error", "cancelled", "canceled"}:
        return "failed"
    return normalized or "submitted"


def build_default_video_prompt() -> str:
    base_prompt = settings.AGNES_VIDEO_DEFAULT_PROMPT.strip()
    return (
        f"{base_prompt} "
        "Preserve the full original frame and aspect ratio of the repaired photo. "
        "Do not crop, zoom, reframe, or change the composition boundaries."
    ).strip()


def choose_repair_aspect_ratio(image_key: str | None, fallback: AspectRatio) -> AspectRatio:
    if not image_key:
        return fallback
    try:
        image_bytes = storage_manager.download_file(image_key)
        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
        ratio = width / height if height else 1
        ratio_map = {
            AspectRatio.SQUARE: 1.0,
            AspectRatio.PORTRAIT: 3 / 4,
            AspectRatio.LANDSCAPE: 16 / 9,
            AspectRatio.STORY: 9 / 16,
        }
        selected = min(ratio_map.items(), key=lambda item: abs(item[1] - ratio))[0]
        print(
            "[Repair Aspect Ratio] "
            f"image_key={image_key}, width={width}, height={height}, selected={selected}"
        )
        return selected
    except Exception as error:
        print(f"[Repair Aspect Ratio] failed to inspect source image: {error}")
        return fallback


def choose_video_dimensions(image_key: str | None) -> tuple[int, int] | None:
    if not image_key:
        return None
    try:
        image_bytes = storage_manager.download_file(image_key)
        with Image.open(io.BytesIO(image_bytes)) as image:
            source_width, source_height = image.size
        if not source_width or not source_height:
            return None

        # Keep the original aspect ratio but avoid unnecessary upscaling for video creation.
        long_edge = 1152
        source_long_edge = max(source_width, source_height)
        scale = min(1.0, long_edge / float(source_long_edge))

        width = max(256, int(round((source_width * scale) / 16) * 16))
        height = max(256, int(round((source_height * scale) / 16) * 16))
        print(
            "[Repair Video Dimensions] "
            f"image_key={image_key}, source_size={source_width}x{source_height}, target_size={width}x{height}"
        )
        return width, height
    except Exception as error:
        print(f"[Repair Video Dimensions] failed to inspect repaired image: {error}")
        return None


async def refund_video_credits_if_needed(db: AsyncSession, task: GenerationTask, user: User) -> None:
    existing_charge = await db.execute(
        select(CreditTransaction).where(
            CreditTransaction.user_id == user.id,
            CreditTransaction.transaction_type == "video_generate",
            CreditTransaction.reference_id == task.id,
        )
    )
    charge_count = len(existing_charge.scalars().all())

    existing_refund = await db.execute(
        select(CreditTransaction).where(
            CreditTransaction.user_id == user.id,
            CreditTransaction.transaction_type == "video_refund",
            CreditTransaction.reference_id == task.id,
        )
    )
    refund_count = len(existing_refund.scalars().all())
    if refund_count >= charge_count:
        return

    user.mileage_balance = (user.mileage_balance or 0) + settings.VIDEO_GENERATION_CREDIT_COST
    refund_tx = CreditTransaction(
        user_id=user.id,
        change=settings.VIDEO_GENERATION_CREDIT_COST,
        balance_after=user.mileage_balance,
        transaction_type="video_refund",
        reference_id=task.id,
        description="Refund for failed Agnes video generation",
    )
    db.add(refund_tx)


async def process_repair_video_task(task_id: str) -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(GenerationTask).where(GenerationTask.id == task_id))
        task = result.scalars().first()
        if not task or not task.video_external_task_id:
            return

        user_result = await db.execute(select(User).where(User.id == task.user_id))
        user = user_result.scalars().first()

        try:
            print(
                "[Repair Video Worker Start] "
                f"task_id={task.id}, user_id={task.user_id}, external_task_id={task.video_external_task_id}, "
                f"existing_status={task.video_status}, result_url={task.result_url}"
            )
            for index in range(120):
                payload = await asyncio.to_thread(agnes_video_adapter.get_video_task, task.video_external_task_id)
                video_status = normalize_video_status(payload.get("status"))
                task.video_status = video_status
                task.video_progress = int(payload.get("progress") or 0)
                candidate_urls = collect_video_url_candidates(payload)
                print(
                    "[Repair Video Worker Poll] "
                    f"task_id={task.id}, external_task_id={task.video_external_task_id}, poll_index={index + 1}, "
                    f"raw_status={payload.get('status')}, normalized_status={video_status}, "
                    f"progress={task.video_progress}, candidate_urls={candidate_urls}, "
                    f"payload={summarize_video_payload(payload)}"
                )

                if video_status == "completed":
                    video_url = extract_video_url(payload)
                    if not video_url:
                        print(
                            "[Repair Video Worker Missing URL] "
                            f"task_id={task.id}, external_task_id={task.video_external_task_id}, "
                            f"candidate_urls={candidate_urls}, payload={summarize_video_payload(payload)}"
                        )
                        raise Exception("Agnes video completed without video_url")

                    video_data, content_type = await asyncio.to_thread(agnes_video_adapter.download_video, video_url)
                    video_ref = await asyncio.to_thread(
                        storage_manager.upload_file,
                        io.BytesIO(video_data),
                        f"{task.id}.mp4",
                        content_type or "video/mp4",
                        "videos",
                    )
                    print(
                        "[Repair Video Worker Upload Success] "
                        f"task_id={task.id}, external_task_id={task.video_external_task_id}, "
                        f"content_type={content_type}, storage_type={storage_manager.storage_type}, video_ref={video_ref}"
                    )
                    task.result_video_url = video_ref
                    task.video_progress = 100
                    task.video_error_message = None
                    await db.commit()
                    return

                if video_status == "failed":
                    task.video_error_message = str(payload.get("error") or payload.get("message") or "视频生成失败")
                    print(
                        "[Repair Video Worker Failed] "
                        f"task_id={task.id}, external_task_id={task.video_external_task_id}, "
                        f"error_message={task.video_error_message}, payload={summarize_video_payload(payload)}"
                    )
                    if user:
                        await refund_video_credits_if_needed(db, task, user)
                    await db.commit()
                    return

                await db.commit()
                await asyncio.sleep(5)

            task.video_status = "failed"
            task.video_error_message = "视频生成超时"
            print(
                "[Repair Video Worker Timeout] "
                f"task_id={task.id}, external_task_id={task.video_external_task_id}"
            )
            if user:
                await refund_video_credits_if_needed(db, task, user)
            await db.commit()
        except Exception as error:
            task.video_status = "failed"
            task.video_error_message = str(error)
            print(
                "[Repair Video Worker Exception] "
                f"task_id={task.id}, external_task_id={task.video_external_task_id}, error={error}"
            )
            if user:
                await refund_video_credits_if_needed(db, task, user)
            await db.commit()


def build_repair_prompt(mode: RepairMode, extra_prompt: str | None = None) -> str:
    prompts = {
        RepairMode.COLORIZE: (
            "如果是翻拍照片，修复照片方向，去除轮廓外的其他元素，仅剩照片主体，帮我把这张老照片做高清修复，尽可能的去除画面里的划痕、折痕、污点和明显噪点，尽量还原人物面部的清晰细节。以自然、符合历史且逼真的方式为这张老黑白照片上色。"
            "请保留原照片的年代感和真实质感，不要把人物修成现代美颜风，不要过度磨皮，整体画面要自然、柔和、干净。"
            "把人物皮肤和整体色调处理得更自然一点，保留老照片的年代感，不要改变人物原本五官。重点优化人物面部清晰度，增强眼睛、鼻子、嘴巴和头发边缘的细节，但不要改变人物长相。"
            "严格保持原图的完整构图、边缘范围和人物数量，不要裁切画面，不要放大取景，不要改变照片比例。"
        ),
        RepairMode.ENHANCE: (
            "如果是翻拍照片，修复照片方向，去除轮廓外的其他元素，仅剩照片主体，帮我把这张老照片做高清修复，尽可能的去除画面里的划痕、折痕、污点和明显噪点，尽量还原人物面部的清晰细节。"
            "请保留原照片的年代感和真实质感，不要把人物修成现代美颜风，不要过度磨皮，整体画面要自然、柔和、干净。"
            "把人物皮肤和整体色调处理得更自然一点，保留老照片的年代感，不要改变人物原本五官。重点优化人物面部清晰度，增强眼睛、鼻子、嘴巴和头发边缘的细节，但不要改变人物长相。"
            "严格保持原图的完整构图、边缘范围和人物数量，不要裁切画面，不要放大取景，不要改变照片比例。"
        ),
    }
    prompt = prompts[mode]
    if extra_prompt:
        prompt = f"{prompt} Additional instruction: {extra_prompt.strip()}"
    return prompt


def infer_repair_mode(task: GenerationTask) -> RepairMode | None:
    task_type = str(task.task_type or "")
    if task_type == "old_photo_colorize":
        return RepairMode.COLORIZE
    if task_type == "old_photo_enhance":
        return RepairMode.ENHANCE
    return None


@router.post("/tasks", response_model=RepairTaskResponse, response_model_by_alias=False)
async def create_repair_task(
    request: RepairTaskCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if not request.image_url.strip():
        raise HTTPException(status_code=422, detail="image_url is required")
    if (current_user.mileage_balance or 0) < 1:
        raise HTTPException(status_code=402, detail="Insufficient photo credits")

    normalized_image_url = storage_manager.normalize_file_reference(request.image_url.strip())
    prompt = build_repair_prompt(request.mode, request.extra_prompt)
    resolved_aspect_ratio = choose_repair_aspect_ratio(normalized_image_url, request.aspect_ratio)
    task = GenerationTask(
        user_id=current_user.id,
        prompt=prompt,
        task_type=f"old_photo_{request.mode.value}",
        style=ArtStyle.REALISTIC,
        aspect_ratio=resolved_aspect_ratio,
        reference_image_url=normalized_image_url,
        prompt_trace=json.dumps(
            {
                "repair_mode": request.mode.value,
                "reference_image_urls": [normalized_image_url],
                "requested_aspect_ratio": request.aspect_ratio,
                "resolved_aspect_ratio": resolved_aspect_ratio,
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

    return serialize_repair_task(task, mode=request.mode)


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

    return serialize_repair_task(task, mode=infer_repair_mode(task))


@router.post("/tasks/{task_id}/regenerate", response_model=RepairTaskResponse, response_model_by_alias=False)
async def regenerate_repair_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(GenerationTask).where(
            GenerationTask.id == task_id,
            GenerationTask.user_id == current_user.id,
        )
    )
    source_task = result.scalars().first()
    if not source_task:
        raise HTTPException(status_code=404, detail="Repair task not found")
    if source_task.status != TaskStatus.COMPLETED or not source_task.reference_image_url:
        raise HTTPException(status_code=409, detail="请先完成照片修复后再重新生成")
    if (current_user.mileage_balance or 0) < 1:
        raise HTTPException(status_code=402, detail="Insufficient photo credits")

    prompt_trace = {
        "regenerated_from_task_id": source_task.id,
        "task_type": source_task.task_type,
        "reference_image_urls": [source_task.reference_image_url],
        "resolved_aspect_ratio": source_task.aspect_ratio.value if hasattr(source_task.aspect_ratio, "value") else str(source_task.aspect_ratio),
    }
    regenerated_task = GenerationTask(
        user_id=current_user.id,
        prompt=source_task.prompt,
        task_type=source_task.task_type,
        style=source_task.style,
        aspect_ratio=source_task.aspect_ratio,
        reference_image_url=source_task.reference_image_url,
        prompt_trace=json.dumps(prompt_trace, ensure_ascii=False),
        status=TaskStatus.PENDING,
        progress=0,
    )
    db.add(regenerated_task)
    await db.commit()
    await db.refresh(regenerated_task)

    print(
        "[Repair Regenerate Create] "
        f"source_task_id={source_task.id}, new_task_id={regenerated_task.id}, user_id={current_user.id}"
    )

    background_tasks.add_task(process_generation_task, str(regenerated_task.id))
    return serialize_repair_task(regenerated_task, mode=infer_repair_mode(regenerated_task))


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

    return ExportResponse(
        task_id=task.id,
        result_url=storage_manager.resolve_public_url(task.result_url, expires=900) or "",
        balance=current_user.mileage_balance or 0,
        charged=False,
        transaction_id=None,
    )


@router.post("/tasks/{task_id}/video", response_model=RepairTaskResponse, response_model_by_alias=False)
async def create_repair_video(
    task_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if settings.MOCK_IMAGE_GENERATION:
        raise HTTPException(status_code=409, detail="请先关闭 MOCK_IMAGE_GENERATION 后再生成视频")

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
        raise HTTPException(status_code=409, detail="请先完成照片修复后再生成视频")

    if task.video_status in {"submitted", "processing"}:
        return serialize_repair_task(task)

    if (current_user.mileage_balance or 0) < settings.VIDEO_GENERATION_CREDIT_COST:
        raise HTTPException(status_code=402, detail="Insufficient video credits")

    prompt = build_default_video_prompt()
    source_image_url = storage_manager.resolve_public_url(task.result_url, expires=1800)
    if not source_image_url:
        raise HTTPException(status_code=409, detail="修复图片地址无效，无法生成视频")
    target_dimensions = choose_video_dimensions(task.result_url)
    video_width = target_dimensions[0] if target_dimensions else None
    video_height = target_dimensions[1] if target_dimensions else None

    print(
        "[Repair Video Create Start] "
        f"task_id={task.id}, user_id={current_user.id}, source_image_url={source_image_url}, "
        f"prompt={prompt}, width={video_width}, height={video_height}"
    )
    try:
        create_payload = await asyncio.to_thread(
            agnes_video_adapter.create_video_task,
            prompt,
            source_image_url,
            video_width,
            video_height,
        )
    except requests.exceptions.Timeout as error:
        print(
            "[Repair Video Create Timeout] "
            f"task_id={task.id}, user_id={current_user.id}, width={video_width}, height={video_height}, error={error}"
        )
        raise HTTPException(status_code=504, detail="Agnes 视频任务创建超时，请稍后重试") from error
    except requests.exceptions.RequestException as error:
        print(
            "[Repair Video Create Request Error] "
            f"task_id={task.id}, user_id={current_user.id}, width={video_width}, height={video_height}, error={error}"
        )
        raise HTTPException(status_code=502, detail="Agnes 视频任务创建失败，请稍后重试") from error
    except Exception as error:
        print(
            "[Repair Video Create Exception] "
            f"task_id={task.id}, user_id={current_user.id}, width={video_width}, height={video_height}, error={error}"
        )
        raise HTTPException(status_code=502, detail=str(error) or "Agnes 视频任务创建失败") from error
    print(
        "[Repair Video Create Payload] "
        f"task_id={task.id}, payload={summarize_video_payload(create_payload)}"
    )

    external_task_id = str(create_payload.get("id") or "").strip()
    if not external_task_id:
        raise HTTPException(status_code=502, detail="Agnes video task creation failed: missing task id")

    current_user.mileage_balance = (current_user.mileage_balance or 0) - settings.VIDEO_GENERATION_CREDIT_COST
    transaction = CreditTransaction(
        user_id=current_user.id,
        change=-settings.VIDEO_GENERATION_CREDIT_COST,
        balance_after=current_user.mileage_balance,
        transaction_type="video_generate",
        reference_id=task.id,
        description="Generate old-photo animation video",
    )
    db.add(transaction)

    task.video_external_task_id = external_task_id
    task.video_status = normalize_video_status(create_payload.get("status"))
    task.video_progress = int(create_payload.get("progress") or 0)
    task.video_error_message = None
    task.video_prompt = prompt
    task.result_video_url = None

    await db.commit()
    await db.refresh(current_user)
    await db.refresh(task)

    print(
        "[Repair Video Create Success] "
        f"task_id={task.id}, external_task_id={external_task_id}, "
        f"video_status={task.video_status}, video_progress={task.video_progress}, "
        f"balance_after={current_user.mileage_balance}"
    )

    background_tasks.add_task(process_repair_video_task, str(task.id))
    return serialize_repair_task(task)
