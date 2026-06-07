import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
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
    WechatPayCreateResponse,
)
from app.services.wechat_pay import WechatPayError, WechatPayTimeoutError, wechat_pay_service

router = APIRouter()


def build_wechat_out_trade_no() -> str:
    return f"wx{uuid.uuid4().hex[:30]}"


def parse_wechat_paid_at(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


async def apply_paid_order_credits_if_needed(db: AsyncSession, order: Order, user: User) -> CreditTransaction | None:
    existing_tx_result = await db.execute(
        select(CreditTransaction).where(
            CreditTransaction.user_id == user.id,
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.reference_id == order.id,
        )
    )
    existing_tx = existing_tx_result.scalars().first()
    if existing_tx:
        return existing_tx

    user.mileage_balance = (user.mileage_balance or 0) + order.credits
    transaction = CreditTransaction(
        user_id=user.id,
        change=order.credits,
        balance_after=user.mileage_balance,
        transaction_type="purchase",
        reference_id=order.id,
        description=f"WeChat purchase: {order.title}",
    )
    db.add(transaction)
    return transaction


async def sync_wechat_order_status_if_needed(db: AsyncSession, order: Order, user: User) -> Order:
    if order.payment_provider != "wechat" or not order.provider_trade_no:
        return order
    if order.status == "paid":
        return order

    try:
        payload = await asyncio.to_thread(
            wechat_pay_service.query_order_by_out_trade_no,
            out_trade_no=order.provider_trade_no,
        )
    except WechatPayError as exc:
        print(
            "[WeChat Pay Query Failed] "
            f"order_id={order.id}, out_trade_no={order.provider_trade_no}, error={exc}"
        )
        return order

    trade_state = str(payload.get("trade_state") or "").strip().upper()
    transaction_id = str(payload.get("transaction_id") or "").strip()
    if trade_state == "SUCCESS":
        await apply_paid_order_credits_if_needed(db, order, user)
        order.status = "paid"
        order.paid_at = parse_wechat_paid_at(payload.get("success_time"))
        await db.commit()
        await db.refresh(order)
        await db.refresh(user)
        print(
            "[WeChat Pay Query Success] "
            f"order_id={order.id}, out_trade_no={order.provider_trade_no}, transaction_id={transaction_id}, "
            f"user_id={user.id}, balance={user.mileage_balance}"
        )
        return order

    if trade_state:
        order.status = f"wechat_{trade_state.lower()}"
        order.paid_at = None
        await db.commit()
        await db.refresh(order)
        print(
            "[WeChat Pay Query NonSuccess] "
            f"order_id={order.id}, out_trade_no={order.provider_trade_no}, trade_state={trade_state}"
        )
    return order

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


@router.post("/wechat/create", response_model=WechatPayCreateResponse)
async def create_wechat_purchase(
    request: PurchaseRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    package = get_packages().get(request.package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    if not current_user.openid:
        raise HTTPException(status_code=409, detail="当前账号未绑定微信 openid，无法发起微信支付")

    try:
        wechat_pay_service.ensure_configured()
    except WechatPayError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    out_trade_no = build_wechat_out_trade_no()
    print(
        "[WeChat Pay Create Start] "
        f"user_id={current_user.id}, package_id={package.id}, title={package.title}, "
        f"amount_cents={package.price_cents}, out_trade_no={out_trade_no}"
    )
    order = Order(
        user_id=current_user.id,
        package_id=package.id,
        title=package.title,
        price_cents=package.price_cents,
        credits=package.credits,
        status="pending",
        payment_provider="wechat",
        provider_trade_no=out_trade_no,
        paid_at=None,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    if order.paid_at is not None:
        order.paid_at = None
        await db.commit()
        await db.refresh(order)

    try:
        pay_data = await asyncio.to_thread(
            wechat_pay_service.create_jsapi_order,
            description=package.title,
            out_trade_no=out_trade_no,
            amount_cents=package.price_cents,
            openid=current_user.openid,
        )
    except WechatPayTimeoutError as exc:
        order.status = "create_timeout"
        await db.commit()
        print(
            "[WeChat Pay Create Timeout] "
            f"order_id={order.id}, user_id={current_user.id}, package_id={package.id}, "
            f"amount_cents={package.price_cents}, out_trade_no={out_trade_no}, error={exc}"
        )
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except WechatPayError as exc:
        order.status = "create_failed"
        await db.commit()
        print(
            "[WeChat Pay Create Failed] "
            f"order_id={order.id}, user_id={current_user.id}, package_id={package.id}, "
            f"amount_cents={package.price_cents}, out_trade_no={out_trade_no}, error={exc}"
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    print(
        "[WeChat Pay Create Success] "
        f"order_id={order.id}, user_id={current_user.id}, package_id={package.id}, "
        f"amount_cents={package.price_cents}, out_trade_no={out_trade_no}, "
        f"prepay_id={pay_data.get('prepay_id', '')}"
    )

    return WechatPayCreateResponse(
        order_id=order.id,
        package_id=package.id,
        payment_provider="wechat",
        timeStamp=pay_data["timeStamp"],
        nonceStr=pay_data["nonceStr"],
        package=pay_data["package"],
        signType=pay_data["signType"],
        paySign=pay_data["paySign"],
    )


@router.post("/wechat/notify")
async def wechat_pay_notify(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Any:
    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8")
    headers = dict(request.headers)

    try:
        await asyncio.to_thread(wechat_pay_service.verify_notification, headers, body_text)
        payload = json.loads(body_text or "{}")
        resource = payload.get("resource") or {}
        if not resource:
            raise WechatPayError("WeChat Pay notify resource missing")
        notify_data = await asyncio.to_thread(wechat_pay_service.decrypt_notification_resource, resource)
    except Exception as exc:
        print(f"[WeChat Pay Notify Failed] error={exc}, body={body_text[:1000]}")
        return JSONResponse(status_code=400, content={"code": "FAIL", "message": "notify failed"})

    out_trade_no = str(notify_data.get("out_trade_no") or "").strip()
    trade_state = str(notify_data.get("trade_state") or "").strip().upper()
    transaction_id = str(notify_data.get("transaction_id") or "").strip()
    if not out_trade_no:
        return JSONResponse(status_code=400, content={"code": "FAIL", "message": "out_trade_no missing"})

    order_result = await db.execute(select(Order).where(Order.provider_trade_no == out_trade_no))
    order = order_result.scalars().first()
    if not order:
        print(f"[WeChat Pay Notify Unknown Order] out_trade_no={out_trade_no}, payload={notify_data}")
        return JSONResponse(status_code=400, content={"code": "FAIL", "message": "order not found"})

    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalars().first()
    if not user:
        return JSONResponse(status_code=400, content={"code": "FAIL", "message": "user not found"})

    if trade_state == "SUCCESS":
        await apply_paid_order_credits_if_needed(db, order, user)
        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)
        await db.commit()
        print(
            "[WeChat Pay Notify Success] "
            f"order_id={order.id}, out_trade_no={out_trade_no}, transaction_id={transaction_id}, "
            f"user_id={user.id}, balance={user.mileage_balance}"
        )
        return {"code": "SUCCESS", "message": "成功"}

    order.status = f"wechat_{trade_state.lower()}" if trade_state else "wechat_unknown"
    await db.commit()
    print(
        "[WeChat Pay Notify NonSuccess] "
        f"order_id={order.id}, out_trade_no={out_trade_no}, trade_state={trade_state}, payload={notify_data}"
    )
    return {"code": "SUCCESS", "message": "成功"}


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20,
    successful_only: bool = False,
) -> Any:
    if successful_only:
        pending_result = await db.execute(
            select(Order)
            .where(
                Order.user_id == current_user.id,
                Order.payment_provider == "wechat",
                Order.status.in_(("pending", "create_timeout", "wechat_userpaying")),
            )
            .order_by(Order.created_at.desc())
            .limit(5)
        )
        for order in pending_result.scalars().all():
            await sync_wechat_order_status_if_needed(db, order, current_user)

    stmt = select(Order).where(Order.user_id == current_user.id)
    if successful_only:
        stmt = stmt.where(Order.status.in_(("paid", "mock_paid")))
    result = await db.execute(
        stmt.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.user_id == current_user.id,
        )
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_provider == "wechat" and order.status != "paid":
        order = await sync_wechat_order_status_if_needed(db, order, current_user)
    return order


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
