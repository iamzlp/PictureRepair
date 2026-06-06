from datetime import timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db, AsyncSession
from app.models.billing import CreditTransaction, Order
from app.models.feedback import UserFeedback
from app.models.photo import Photo
from app.models.task import GenerationTask
from app.models.user import User
from app.schemas.user import Token, UserResponse, UserUpdate, WeChatLoginRequest, WeChatPhoneLoginResponse, WeChatPhoneRequest
from app.services.storage import storage_manager

router = APIRouter()


def create_user_token(user: User) -> Token:
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        phone=user.phone,
        openid=user.openid,
        unionid=user.unionid,
        nickname=user.nickname,
        avatar_url=storage_manager.resolve_public_url(user.avatar_url, expires=1800),
        mileage_balance=user.mileage_balance or 0,
        created_at=user.created_at,
    )


def apply_user_profile(user: User, request: WeChatPhoneRequest, fallback_user: User | None = None) -> None:
    nickname = (request.nickname or "").strip()
    avatar_url = (request.avatar_url or "").strip()

    if nickname:
        user.nickname = nickname[:64]
    elif fallback_user and not user.nickname and fallback_user.nickname:
        fallback_nickname = fallback_user.nickname.strip()
        if fallback_nickname:
            user.nickname = fallback_nickname[:64]

    if avatar_url:
        user.avatar_url = storage_manager.normalize_file_reference(avatar_url)
    elif fallback_user and not user.avatar_url and fallback_user.avatar_url:
        user.avatar_url = fallback_user.avatar_url


async def reassign_user_records(
    db: AsyncSession,
    from_user_id: str,
    to_user_id: str,
) -> None:
    for model in (GenerationTask, Photo, Order, CreditTransaction, UserFeedback):
        await db.execute(
            update(model)
            .where(model.user_id == from_user_id)
            .values(user_id=to_user_id)
        )

@router.post("/login/mock", response_model=Token)
async def login_mock(
    phone: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Mock login for development. 
    If user exists, return token.
    If not, create user and return token.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalars().first()

    if not user:
        # Create new user
        user = User(phone=phone, nickname=f"User_{phone[-4:]}")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return create_user_token(user)


@router.post("/login/wechat", response_model=Token)
async def login_wechat(
    request: WeChatLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Login with wx.login code. In production this exchanges the code for openid.
    Set MOCK_WECHAT_LOGIN=true for local UI debugging without real WeChat credentials.
    """
    code = request.code.strip()
    if not code:
        raise HTTPException(status_code=422, detail="code is required")

    if settings.MOCK_WECHAT_LOGIN:
        openid = f"mock_openid_{code[-12:]}"
        unionid = None
    else:
        if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
            raise HTTPException(status_code=500, detail="WECHAT_APPID/WECHAT_SECRET not configured")

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.weixin.qq.com/sns/jscode2session",
                params={
                    "appid": settings.WECHAT_APPID,
                    "secret": settings.WECHAT_SECRET,
                    "js_code": code,
                    "grant_type": "authorization_code",
                },
            )
        data = resp.json()
        if data.get("errcode"):
            raise HTTPException(status_code=400, detail=data.get("errmsg", "WeChat login failed"))
        openid = data.get("openid")
        unionid = data.get("unionid")
        if not openid:
            raise HTTPException(status_code=400, detail="No openid in WeChat response")

    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalars().first()
    if not user:
        user = User(openid=openid, unionid=unionid, nickname="微信用户")
        db.add(user)
    else:
        user.unionid = unionid or user.unionid

    await db.commit()
    await db.refresh(user)
    return create_user_token(user)


@router.post("/phone/wechat", response_model=WeChatPhoneLoginResponse)
async def bind_wechat_phone(
    request: WeChatPhoneRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Bind phone using the code returned by getPhoneNumber.
    Requires real WECHAT_APPID/WECHAT_SECRET and a valid mini program environment.
    """
    if settings.MOCK_WECHAT_LOGIN:
        digits = "".join(str(ord(char) % 10) for char in current_user.id)
        mock_phone = f"13{digits[:9].ljust(9, '0')}"
        current_user.phone = mock_phone
        apply_user_profile(current_user, request)
        await db.commit()
        await db.refresh(current_user)
        token = create_user_token(current_user)
        return WeChatPhoneLoginResponse(
            access_token=token.access_token,
            token_type=token.token_type,
            user=serialize_user(current_user),
        )

    if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
        raise HTTPException(status_code=500, detail="WECHAT_APPID/WECHAT_SECRET not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.get(
            "https://api.weixin.qq.com/cgi-bin/token",
            params={
                "grant_type": "client_credential",
                "appid": settings.WECHAT_APPID,
                "secret": settings.WECHAT_SECRET,
            },
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail=token_data.get("errmsg", "Failed to get WeChat access_token"))

        phone_resp = await client.post(
            "https://api.weixin.qq.com/wxa/business/getuserphonenumber",
            params={"access_token": access_token},
            json={"code": request.code},
        )

    phone_data = phone_resp.json()
    if phone_data.get("errcode"):
        raise HTTPException(status_code=400, detail=phone_data.get("errmsg", "Failed to get phone number"))

    phone_info = phone_data.get("phone_info") or {}
    phone_number = phone_info.get("phoneNumber")
    if not phone_number:
        raise HTTPException(status_code=400, detail="No phone number in WeChat response")

    existing = await db.execute(select(User).where(User.phone == phone_number))
    existing_user = existing.scalars().first()
    if existing_user and existing_user.id != current_user.id:
        source_openid = current_user.openid
        source_unionid = current_user.unionid

        current_user.openid = None
        current_user.unionid = None
        await db.flush()

        existing_user.openid = source_openid or existing_user.openid
        existing_user.unionid = source_unionid or existing_user.unionid
        apply_user_profile(existing_user, request, fallback_user=current_user)

        await reassign_user_records(db, current_user.id, existing_user.id)
        await db.delete(current_user)
        await db.commit()
        await db.refresh(existing_user)

        token = create_user_token(existing_user)
        return WeChatPhoneLoginResponse(
            access_token=token.access_token,
            token_type=token.token_type,
            user=serialize_user(existing_user),
        )

    current_user.phone = phone_number
    apply_user_profile(current_user, request)
    await db.commit()
    await db.refresh(current_user)
    token = create_user_token(current_user)
    return WeChatPhoneLoginResponse(
        access_token=token.access_token,
        token_type=token.token_type,
        user=serialize_user(current_user),
    )

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return serialize_user(current_user)


@router.put("/me", response_model=UserResponse)
async def update_users_me(
    request: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    nickname = (request.nickname or "").strip()
    avatar_url = (request.avatar_url or "").strip()

    if request.nickname is not None:
        current_user.nickname = nickname[:64] if nickname else None

    if request.avatar_url is not None:
        current_user.avatar_url = storage_manager.normalize_file_reference(avatar_url) if avatar_url else None

    await db.commit()
    await db.refresh(current_user)
    return serialize_user(current_user)
