from pydantic import BaseModel, Field

from app.schemas.common import SuccessResponse


class PhoneOTPRequest(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$", description="10-digit Indian mobile number")


class VerifyOTPRequest(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    otp: str = Field(min_length=4, max_length=8)
    device_id: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 1800


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    phone: str
    full_name: str
    role: str
    language: str = "hi"


class LoginResponse(BaseModel):
    tokens: TokenResponse
    user: UserSummary


class BiometricRegisterRequest(BaseModel):
    device_id: str
    public_key: str | None = None
    biometric_token: str | None = None


class BiometricVerifyRequest(BaseModel):
    device_id: str
    biometric_token: str | None = None


class BiometricRegisterResponse(SuccessResponse):
    registered: bool = True
    device_id: str


class BiometricVerifyResponse(BaseModel):
    verified: bool
    tokens: TokenResponse | None = None
    user: UserSummary | None = None
