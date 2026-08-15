from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.other_domain import ASHAKPIResponse

RoleLiteral = Literal["asha", "anm", "moic", "bpm", "dpm", "state_admin", "patient", "super_admin"]


class UserCreate(BaseModel):
    role: RoleLiteral = "asha"
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    email: EmailStr | None = None
    full_name: str = Field(min_length=2, max_length=200)
    full_name_local: dict[str, str] | None = None
    employee_id: str | None = None
    state_id: str | None = None
    district_id: str | None = None
    block_id: str | None = None
    phc_id: str | None = None
    sub_center_id: str | None = None
    village_id: str | None = None
    language: str = "hi"
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    full_name_local: dict[str, str] | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    language: str | None = None
    role: RoleLiteral | None = None
    employee_id: str | None = None
    state_id: str | None = None
    district_id: str | None = None
    block_id: str | None = None
    phc_id: str | None = None
    sub_center_id: str | None = None
    village_id: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    employee_id: str | None = None
    phone: str
    email: str | None = None
    full_name: str
    full_name_local: dict[str, str] | None = None
    avatar_url: str | None = None
    language: str = "hi"
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class ASHAProfileCreate(BaseModel):
    asha_id: str = Field(min_length=3, max_length=64)
    bank_account: dict[str, Any] | None = None
    aadhaar_hash: str | None = None
    pan: str | None = None
    qualification: str | None = None
    experience_years: float | None = None
    training_status: dict[str, Any] | None = None
    supervisor_id: str | None = None
    catchment_villages: list[str] | None = None


class ASHAProfileUpdate(BaseModel):
    bank_account: dict[str, Any] | None = None
    aadhaar_hash: str | None = None
    pan: str | None = None
    qualification: str | None = None
    experience_years: float | None = None
    training_status: dict[str, Any] | None = None
    supervisor_id: str | None = None
    catchment_villages: list[str] | None = None


class ASHAProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    asha_id: str
    bank_account: dict[str, Any] | None = None
    aadhaar_hash: str | None = None
    pan: str | None = None
    qualification: str | None = None
    experience_years: float | None = None
    training_status: dict[str, Any] | None = None
    supervisor_id: str | None = None
    catchment_villages: list[str] | None = None
    performance_score: float | None = None


class ASHAUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asha_id: str
    name: str
    village: str | None = None
    phone: str
    assigned_households: int = 0
    performance_score: float | None = None
    status: str = "active"
    last_sync_at: datetime | None = None


class ASHADetailResponse(BaseModel):
    asha: ASHAUserResponse
    kpis: list[ASHAKPIResponse] = []
    villages: list[str] = []
    assigned_beneficiaries: int = 0


class ASHACreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    village: str | None = None
    status: str = "active"


class ASHAUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    village: str | None = None
    status: str | None = None
    performance_score: float | None = Field(default=None, ge=0, le=100)


class ASHAAssignVillages(BaseModel):
    villages: list[str] = Field(default_factory=list)
