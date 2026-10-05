from pydantic import BaseModel, Field

from app.schemas.common import SuccessResponse


class PhoneOTPRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$", description="10-digit Indian mobile number")


class VerifyOTPRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    otp: str = Field(min_length=4, max_length=8)
    device_id: str | None = None


class PasswordLoginRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=1, max_length=128)
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
