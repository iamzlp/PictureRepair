from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CreditPackage(BaseModel):
    id: str
    title: str
    price_cents: int
    credits: int


class PurchaseRequest(BaseModel):
    package_id: str


class PurchaseResponse(BaseModel):
    order_id: str
    transaction_id: str
    package_id: str
    credits_added: int
    balance: int


class ExportResponse(BaseModel):
    task_id: str
    result_url: str
    balance: int
    charged: bool = True
    transaction_id: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    package_id: str
    title: str
    price_cents: int
    credits: int
    status: str
    payment_provider: str
    created_at: datetime
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CreditTransactionResponse(BaseModel):
    id: str
    change: int
    balance_after: int
    transaction_type: str
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
