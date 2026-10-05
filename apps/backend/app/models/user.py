from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Role(StrEnum):
    ASHA = "asha"
    ADMIN = "admin"
    PATIENT = "patient"


class User(BaseModel):
    __tablename__ = "users"

    auth_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(32), default=Role.ASHA.value, index=True)

    state_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    district_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    block_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    phc_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    sub_center_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    village_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    employee_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    full_name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="hi")

    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ASHAProfile(BaseModel):
    __tablename__ = "asha_profiles"

    user_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    asha_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    date_of_joining: Mapped[date | None] = mapped_column(Date, nullable=True)
    bank_account: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    aadhaar_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(200), nullable=True)
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    training_status: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    supervisor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    catchment_villages: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    performance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
