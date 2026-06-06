from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Shared properties
class UserBase(BaseModel):
    phone: Optional[str] = None
    openid: Optional[str] = None
    unionid: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    pass

# Properties to receive via API on update
class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None

# Properties to return to client
class UserResponse(UserBase):
    id: str
    mileage_balance: int
    created_at: datetime

    model_config = {"from_attributes": True}

# JWT Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None


class WeChatLoginRequest(BaseModel):
    code: str


class WeChatPhoneRequest(BaseModel):
    code: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class WeChatPhoneLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
