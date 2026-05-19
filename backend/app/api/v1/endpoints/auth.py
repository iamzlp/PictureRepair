from datetime import timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db, AsyncSession
from app.models.user import User
from app.schemas.user import Token, UserResponse, WeChatLoginRequest, WeChatPhoneRequest

router = APIRouter()


def create_user_token(user: User) -> Token:
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")

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


@router.post("/phone/wechat", response_model=UserResponse)
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
        await db.commit()
        await db.refresh(current_user)
        return current_user

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
        raise HTTPException(status_code=409, detail="Phone number is already bound")

    current_user.phone = phone_number
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user
