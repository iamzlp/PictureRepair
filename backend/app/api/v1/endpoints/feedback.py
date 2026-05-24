from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.db.session import get_db
from app.models.feedback import UserFeedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreateRequest, FeedbackResponse

router = APIRouter()


def serialize_feedback(feedback: UserFeedback) -> FeedbackResponse:
    return FeedbackResponse(
        id=feedback.id,
        user_id=feedback.user_id,
        feedback_type=feedback.feedback_type,
        content=feedback.content,
        status=feedback.status,
        source=feedback.source,
        page_path=feedback.page_path,
        created_at=feedback.created_at,
    )


@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    request: FeedbackCreateRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    feedback = UserFeedback(
        user_id=current_user.id,
        feedback_type=request.feedback_type.strip()[:50],
        content=request.content.strip(),
        status="submitted",
        source="miniprogram",
        page_path=request.page_path.strip()[:255] if request.page_path else None,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return serialize_feedback(feedback)
