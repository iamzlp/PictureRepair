import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.payments import get_packages
from app.api.v1.endpoints.tasks import process_generation_task
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.admin import AdminAuditLog, AdminUser
from app.models.billing import CreditTransaction, Order
from app.models.task import GenerationTask
from app.models.user import User
from app.services.storage import storage_manager
from app.schemas.admin import (
    AdminAuditLogResponse,
    AdminCreditAdjustmentRequest,
    AdminCreditAdjustmentResponse,
    AdminDashboardSummaryResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminOrderResponse,
    AdminProfileResponse,
    AdminSystemConfigResponse,
    AdminTaskResponse,
    AdminTransactionResponse,
    AdminUserResponse,
)
from app.schemas.task import TaskStatus

router = APIRouter()


def create_admin_token(admin_user: AdminUser) -> str:
    return security.create_access_token(subject=f"admin:{admin_user.id}")


def serialize_task(task: GenerationTask) -> AdminTaskResponse:
    style = task.style.value if hasattr(task.style, "value") else str(task.style)
    aspect_ratio = task.aspect_ratio.value if hasattr(task.aspect_ratio, "value") else str(task.aspect_ratio)
    return AdminTaskResponse(
        task_id=task.id,
        user_id=task.user_id,
        batch_id=task.batch_id,
        status=task.status,
        prompt=task.prompt,
        task_type=task.task_type,
        style=style,
        aspect_ratio=aspect_ratio,
        reference_image_url=storage_manager.resolve_public_url(task.reference_image_url, expires=900),
        result_url=storage_manager.resolve_public_url(task.result_url, expires=900),
        progress=task.progress or 0,
        error_message=task.error_message,
        external_task_id=task.external_task_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def serialize_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        phone=user.phone,
        openid=user.openid,
        unionid=user.unionid,
        nickname=user.nickname,
        avatar_url=storage_manager.resolve_public_url(user.avatar_url, expires=1800),
        mileage_balance=user.mileage_balance or 0,
        created_at=user.created_at,
    )


async def create_audit_log(
    db: AsyncSession,
    admin_user: AdminUser,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
) -> AdminAuditLog:
    log = AdminAuditLog(
        admin_user_id=admin_user.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        before_json=json.dumps(before, ensure_ascii=False) if before is not None else None,
        after_json=json.dumps(after, ensure_ascii=False) if after is not None else None,
    )
    db.add(log)
    await db.flush()
    return log


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(
    request: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(AdminUser).where(AdminUser.username == request.username.strip()))
    admin_user = result.scalars().first()
    if not admin_user or not security.verify_password(request.password, admin_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin username or password")
    if not admin_user.is_active:
        raise HTTPException(status_code=403, detail="Admin user is inactive")

    admin_user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(admin_user)

    return AdminLoginResponse(
        access_token=create_admin_token(admin_user),
        token_type="bearer",
        admin=AdminProfileResponse.model_validate(admin_user),
    )


@router.get("/auth/me", response_model=AdminProfileResponse)
async def read_admin_me(
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    return current_admin


@router.get("/dashboard/summary", response_model=AdminDashboardSummaryResponse)
async def admin_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_tasks = (await db.execute(select(func.count()).select_from(GenerationTask))).scalar_one()
    total_orders = (await db.execute(select(func.count()).select_from(Order))).scalar_one()
    total_transactions = (await db.execute(select(func.count()).select_from(CreditTransaction))).scalar_one()
    completed_tasks = (
        await db.execute(select(func.count()).select_from(GenerationTask).where(GenerationTask.status == TaskStatus.COMPLETED))
    ).scalar_one()
    failed_tasks = (
        await db.execute(select(func.count()).select_from(GenerationTask).where(GenerationTask.status == TaskStatus.FAILED))
    ).scalar_one()
    today_new_users = (
        await db.execute(select(func.count()).select_from(User).where(User.created_at >= start_of_day))
    ).scalar_one()
    today_tasks = (
        await db.execute(select(func.count()).select_from(GenerationTask).where(GenerationTask.created_at >= start_of_day))
    ).scalar_one()
    today_exports = (
        await db.execute(
            select(func.count())
            .select_from(CreditTransaction)
            .where(
                CreditTransaction.created_at >= start_of_day,
                CreditTransaction.transaction_type == "export",
            )
        )
    ).scalar_one()
    today_orders = (
        await db.execute(select(func.count()).select_from(Order).where(Order.created_at >= start_of_day))
    ).scalar_one()
    today_revenue_cents = (
        await db.execute(
            select(func.coalesce(func.sum(Order.price_cents), 0))
            .select_from(Order)
            .where(Order.created_at >= start_of_day)
        )
    ).scalar_one()

    return AdminDashboardSummaryResponse(
        total_users=total_users,
        total_tasks=total_tasks,
        total_orders=total_orders,
        total_transactions=total_transactions,
        completed_tasks=completed_tasks,
        failed_tasks=failed_tasks,
        today_new_users=today_new_users,
        today_tasks=today_tasks,
        today_exports=today_exports,
        today_orders=today_orders,
        today_revenue_cents=today_revenue_cents,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def admin_list_users(
    phone: Optional[str] = None,
    nickname: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    stmt = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    if phone:
        stmt = stmt.where(User.phone.ilike(f"%{phone.strip()}%"))
    if nickname:
        stmt = stmt.where(User.nickname.ilike(f"%{nickname.strip()}%"))
    result = await db.execute(stmt)
    return [serialize_user(user) for user in result.scalars().all()]


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def admin_get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user(user)


@router.post("/users/{user_id}/credits/adjust", response_model=AdminCreditAdjustmentResponse)
async def admin_adjust_user_credits(
    user_id: str,
    request: AdminCreditAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    if request.change == 0:
        raise HTTPException(status_code=422, detail="change cannot be 0")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before_balance = user.mileage_balance or 0
    after_balance = before_balance + request.change
    if after_balance < 0:
        raise HTTPException(status_code=409, detail="Balance cannot be negative")

    user.mileage_balance = after_balance
    transaction = CreditTransaction(
        user_id=user.id,
        change=request.change,
        balance_after=after_balance,
        transaction_type="adjust",
        description=f"Admin adjustment: {request.reason}",
    )
    db.add(transaction)
    await db.flush()

    await create_audit_log(
        db=db,
        admin_user=current_admin,
        action="adjust_user_credits",
        target_type="user",
        target_id=user.id,
        reason=request.reason,
        before={"mileage_balance": before_balance},
        after={"mileage_balance": after_balance, "transaction_id": transaction.id, "change": request.change},
    )

    await db.commit()
    await db.refresh(transaction)

    return AdminCreditAdjustmentResponse(
        user_id=user.id,
        transaction_id=transaction.id,
        balance=after_balance,
        change=request.change,
        reason=request.reason,
    )


@router.get("/tasks", response_model=list[AdminTaskResponse])
async def admin_list_tasks(
    status: Optional[TaskStatus] = None,
    task_type: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    stmt = select(GenerationTask).order_by(GenerationTask.created_at.desc()).offset(skip).limit(limit)
    if status:
        stmt = stmt.where(GenerationTask.status == status)
    if task_type:
        stmt = stmt.where(GenerationTask.task_type == task_type)
    if user_id:
        stmt = stmt.where(GenerationTask.user_id == user_id)
    result = await db.execute(stmt)
    return [serialize_task(task) for task in result.scalars().all()]


@router.get("/tasks/{task_id}", response_model=AdminTaskResponse)
async def admin_get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    result = await db.execute(select(GenerationTask).where(GenerationTask.id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return serialize_task(task)


@router.post("/tasks/{task_id}/retry", response_model=AdminTaskResponse)
async def admin_retry_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    result = await db.execute(select(GenerationTask).where(GenerationTask.id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != TaskStatus.FAILED:
        raise HTTPException(status_code=409, detail="Only failed tasks can be retried")

    retried_task = GenerationTask(
        user_id=task.user_id,
        batch_id=task.batch_id,
        prompt=task.prompt,
        task_type=task.task_type,
        prompt_options=task.prompt_options,
        prompt_version=task.prompt_version,
        assembled_prompt=task.assembled_prompt,
        prompt_engine_status=task.prompt_engine_status,
        prompt_trace=task.prompt_trace,
        style=task.style,
        aspect_ratio=task.aspect_ratio,
        reference_image_url=task.reference_image_url,
        status=TaskStatus.PENDING,
        progress=0,
    )
    db.add(retried_task)
    await db.flush()

    await create_audit_log(
        db=db,
        admin_user=current_admin,
        action="retry_task",
        target_type="task",
        target_id=task.id,
        reason="admin retry failed task",
        before={"task_id": task.id, "status": task.status.value, "error_message": task.error_message},
        after={"retried_task_id": retried_task.id, "status": retried_task.status.value},
    )

    await db.commit()
    await db.refresh(retried_task)
    background_tasks.add_task(process_generation_task, str(retried_task.id))
    return serialize_task(retried_task)


@router.get("/orders", response_model=list[AdminOrderResponse])
async def admin_list_orders(
    status: Optional[str] = None,
    package_id: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    stmt = select(Order).order_by(Order.created_at.desc()).offset(skip).limit(limit)
    if status:
        stmt = stmt.where(Order.status == status)
    if package_id:
        stmt = stmt.where(Order.package_id == package_id)
    if user_id:
        stmt = stmt.where(Order.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=AdminOrderResponse)
async def admin_get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/transactions", response_model=list[AdminTransactionResponse])
async def admin_list_transactions(
    user_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    stmt = select(CreditTransaction).order_by(CreditTransaction.created_at.desc()).offset(skip).limit(limit)
    if user_id:
        stmt = stmt.where(CreditTransaction.user_id == user_id)
    if transaction_type:
        stmt = stmt.where(CreditTransaction.transaction_type == transaction_type)
    if reference_id:
        stmt = stmt.where(CreditTransaction.reference_id == reference_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/audit-logs", response_model=list[AdminAuditLogResponse])
async def admin_list_audit_logs(
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    admin_user_id: Optional[str] = None,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    start_at: Optional[datetime] = None,
    end_at: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    stmt = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).offset(skip).limit(limit)
    if action:
        stmt = stmt.where(AdminAuditLog.action == action)
    if target_type:
        stmt = stmt.where(AdminAuditLog.target_type == target_type)
    if admin_user_id:
        stmt = stmt.where(AdminAuditLog.admin_user_id == admin_user_id)
    if target_id:
        stmt = stmt.where(AdminAuditLog.target_id == target_id)
    if reason:
        stmt = stmt.where(AdminAuditLog.reason.ilike(f"%{reason.strip()}%"))
    if start_at:
        stmt = stmt.where(AdminAuditLog.created_at >= start_at)
    if end_at:
        stmt = stmt.where(AdminAuditLog.created_at <= end_at)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/system/config", response_model=AdminSystemConfigResponse)
async def admin_system_config(
    current_admin: AdminUser = Depends(deps.get_current_admin),
) -> Any:
    _ = current_admin
    return AdminSystemConfigResponse(
        storage_type=settings.STORAGE_TYPE,
        image_model=settings.IMAGE_MODEL,
        mock_image_generation=settings.MOCK_IMAGE_GENERATION,
        mock_wechat_login=settings.MOCK_WECHAT_LOGIN,
        payment_use_test_prices=settings.PAYMENT_USE_TEST_PRICES,
        payment_test_price_single_1_cents=settings.PAYMENT_TEST_PRICE_SINGLE_1_CENTS,
        payment_test_price_bundle_30_cents=settings.PAYMENT_TEST_PRICE_BUNDLE_30_CENTS,
        payment_test_price_bundle_90_cents=settings.PAYMENT_TEST_PRICE_BUNDLE_90_CENTS,
        packages=list(get_packages().values()),
    )
