from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.config import settings
from app.db.session import get_db
from app.models.billing import CreditTransaction, Order
from app.models.user import User
from app.schemas import (
    CreditPackage,
    CreditTransactionResponse,
    OrderResponse,
    PurchaseRequest,
    PurchaseResponse,
)

router = APIRouter()

def get_packages() -> dict[str, CreditPackage]:
    single_price = 299
    bundle_30_price = 5000
    bundle_90_price = 10000

    if settings.PAYMENT_USE_TEST_PRICES:
        single_price = settings.PAYMENT_TEST_PRICE_SINGLE_1_CENTS
        bundle_30_price = settings.PAYMENT_TEST_PRICE_BUNDLE_30_CENTS
        bundle_90_price = settings.PAYMENT_TEST_PRICE_BUNDLE_90_CENTS

    return {
        "single_1": CreditPackage(
            id="single_1",
            title="单次照片",
            price_cents=single_price,
            credits=1,
        ),
        "bundle_30": CreditPackage(
            id="bundle_30",
            title="50元30次",
            price_cents=bundle_30_price,
            credits=30,
        ),
        "bundle_90": CreditPackage(
            id="bundle_90",
            title="100元90次",
            price_cents=bundle_90_price,
            credits=90,
        ),
    }


@router.get("/packages", response_model=list[CreditPackage])
async def list_packages() -> Any:
    return list(get_packages().values())


@router.post("/mock-purchase", response_model=PurchaseResponse)
async def mock_purchase(
    request: PurchaseRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    package = get_packages().get(request.package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    order = Order(
        user_id=current_user.id,
        package_id=package.id,
        title=package.title,
        price_cents=package.price_cents,
        credits=package.credits,
        status="mock_paid",
        payment_provider="mock",
    )
    db.add(order)
    await db.flush()

    current_user.mileage_balance = (current_user.mileage_balance or 0) + package.credits
    transaction = CreditTransaction(
        user_id=current_user.id,
        change=package.credits,
        balance_after=current_user.mileage_balance,
        transaction_type="purchase",
        reference_id=order.id,
        description=f"Mock purchase: {package.title}",
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(current_user)
    await db.refresh(order)
    await db.refresh(transaction)

    return PurchaseResponse(
        order_id=order.id,
        transaction_id=transaction.id,
        package_id=package.id,
        credits_added=package.credits,
        balance=current_user.mileage_balance,
    )


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20,
) -> Any:
    result = await db.execute(
        select(Order)
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/transactions", response_model=list[CreditTransactionResponse])
async def list_transactions(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()
