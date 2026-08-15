from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import (
    BiometricRegisterRequest,
    BiometricRegisterResponse,
    BiometricVerifyRequest,
    BiometricVerifyResponse,
    LoginResponse,
    PhoneOTPRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserSummary,
    VerifyOTPRequest,
)
from app.schemas.common import MessageResponse, SuccessResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services.audit import log_action
from app.services.otp import OTPService

router = APIRouter()


def _login_response(user: User) -> LoginResponse:
    tokens = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )
    return LoginResponse(tokens=tokens, user=UserSummary.model_validate(user))


@router.post("/auth/otp/send", response_model=MessageResponse)
async def send_otp(payload: PhoneOTPRequest, request: Request, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(User).where(User.phone == payload.phone))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise NotFoundError("No active user found for this phone number")
    otp = await OTPService.create(payload.phone)
    await log_action(
        db,
        user.id,
        "otp_sent",
        "user",
        user.id,
        ip_address=request.client.host if request.client else None,
        request_id=request.headers.get("X-Request-ID"),
    )
    await db.commit()
    if settings.app_env == "dev":
        return MessageResponse(message=f"OTP sent to {payload.phone} (dev otp: {otp})")
    return MessageResponse(message=f"OTP sent to {payload.phone}")


@router.post("/auth/otp/verify", response_model=LoginResponse)
async def verify_otp(payload: VerifyOTPRequest, request: Request, db: AsyncSession = Depends(get_db_session)):
    ok = await OTPService.verify(payload.phone, payload.otp)
    if not ok:
        raise UnauthorizedError("Invalid or expired OTP")
    result = await db.execute(select(User).where(User.phone == payload.phone))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise NotFoundError("No active user found for this phone number")
    if payload.device_id:
        user.device_id = payload.device_id
    user.last_login_at = datetime.now(UTC)
    await log_action(
        db,
        user.id,
        "otp_verified",
        "user",
        user.id,
        ip_address=request.client.host if request.client else None,
        request_id=request.headers.get("X-Request-ID"),
    )
    await db.commit()
    return _login_response(user)


@router.post("/auth/token/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db_session)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise UnauthorizedError("Invalid or expired refresh token")
    user_id = decoded.get("sub")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise NotFoundError("User not found or inactive")
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/auth/biometric/register", response_model=BiometricRegisterResponse)
async def register_biometric(
    payload: BiometricRegisterRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    user.device_id = payload.device_id
    await db.commit()
    return BiometricRegisterResponse(device_id=payload.device_id)


@router.post("/auth/biometric/verify", response_model=BiometricVerifyResponse)
async def verify_biometric(
    payload: BiometricVerifyRequest,
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(User).where(User.device_id == payload.device_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("No user registered for this device")
    # TODO: validate secure enclave / biometric token signature against stored public key.
    return BiometricVerifyResponse(verified=True, tokens=_login_response(user).tokens)


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/auth/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    data = payload.model_dump(exclude_unset=True, exclude={"role", "is_active"})
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/auth/logout", response_model=SuccessResponse)
async def logout(user: User = Depends(get_current_user)):
    return SuccessResponse(message="Logged out")
