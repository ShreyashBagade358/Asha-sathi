from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.hybrid import hybrid_property

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

    state_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("states.id"), nullable=True, index=True)
    district_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("districts.id"), nullable=True, index=True)
    block_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("blocks.id"), nullable=True, index=True)
    phc_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("phcs.id"), nullable=True, index=True)
    sub_center_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sub_centers.id"), nullable=True, index=True)
    village_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("villages.id"), nullable=True, index=True)

    employee_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    full_name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="hi")

    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # The patient's own beneficiary row (set for role=patient at registration
    # or first sync push). Nullable so ASHA/admin accounts and accounts created
    # before this existed keep working — phone remains the fallback join.
    beneficiary_id: Mapped[str | None] = mapped_column(String(36), unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Relationships for name resolution
    state: Mapped["State"] = relationship("State", foreign_keys=[state_id], lazy="selectin")
    district: Mapped["District"] = relationship("District", foreign_keys=[district_id], lazy="selectin")
    block: Mapped["Block"] = relationship("Block", foreign_keys=[block_id], lazy="selectin")
    phc: Mapped["PHC"] = relationship("PHC", foreign_keys=[phc_id], lazy="selectin")
    sub_center: Mapped["SubCenter"] = relationship("SubCenter", foreign_keys=[sub_center_id], lazy="selectin")
    village: Mapped["Village"] = relationship("Village", foreign_keys=[village_id], lazy="selectin")

    @hybrid_property
    def state_name(self) -> str | None:
        return self.state.name if self.state else None

    @hybrid_property
    def district_name(self) -> str | None:
        return self.district.name if self.district else None

    @hybrid_property
    def block_name(self) -> str | None:
        return self.block.name if self.block else None

    @hybrid_property
    def phc_name(self) -> str | None:
        return self.phc.name if self.phc else None

    @hybrid_property
    def sub_center_name(self) -> str | None:
        return self.sub_center.name if self.sub_center else None

    @hybrid_property
    def village_name(self) -> str | None:
        return self.village.name if self.village else None


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
