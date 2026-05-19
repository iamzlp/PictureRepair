from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.billing import CreditPackage
from app.schemas.task import TaskStatus


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminProfileResponse(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str
    admin: AdminProfileResponse


class AdminUserResponse(BaseModel):
    id: str
    phone: Optional[str] = None
    openid: Optional[str] = None
    unionid: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    mileage_balance: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminCreditAdjustmentRequest(BaseModel):
    change: int = Field(..., description="正数加次，负数扣次，不能为 0")
    reason: str = Field(..., min_length=1, max_length=200)


class AdminCreditAdjustmentResponse(BaseModel):
    user_id: str
    transaction_id: str
    balance: int
    change: int
    reason: str


class AdminTaskResponse(BaseModel):
    task_id: str
    user_id: Optional[str] = None
    batch_id: Optional[str] = None
    status: TaskStatus
    prompt: str
    task_type: Optional[str] = None
    style: str
    aspect_ratio: str
    reference_image_url: Optional[str] = None
    result_url: Optional[str] = None
    progress: int = 0
    error_message: Optional[str] = None
    external_task_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AdminOrderResponse(BaseModel):
    id: str
    user_id: str
    package_id: str
    title: str
    price_cents: int
    credits: int
    status: str
    payment_provider: str
    provider_trade_no: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminTransactionResponse(BaseModel):
    id: str
    user_id: str
    change: int
    balance_after: int
    transaction_type: str
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminDashboardSummaryResponse(BaseModel):
    total_users: int
    total_tasks: int
    total_orders: int
    total_transactions: int
    completed_tasks: int
    failed_tasks: int
    today_new_users: int
    today_tasks: int
    today_exports: int
    today_orders: int
    today_revenue_cents: int


class AdminSystemConfigResponse(BaseModel):
    storage_type: str
    image_model: str
    mock_image_generation: bool
    mock_wechat_login: bool
    payment_use_test_prices: bool
    payment_test_price_single_1_cents: int
    payment_test_price_bundle_30_cents: int
    payment_test_price_bundle_90_cents: int
    packages: list[CreditPackage]


class AdminAuditLogResponse(BaseModel):
    id: str
    admin_user_id: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    reason: Optional[str] = None
    before_json: Optional[str] = None
    after_json: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
