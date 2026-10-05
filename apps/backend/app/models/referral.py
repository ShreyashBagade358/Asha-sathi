from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Referral(BaseModel):
    __tablename__ = "referrals"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    referred_from_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    referred_from_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    referred_to_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    referred_to_specialist_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    referral_type: Mapped[str] = mapped_column(String(40), index=True)
    urgency: Mapped[str] = mapped_column(String(20), default="routine")
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    clinical_summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    investigations: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    provisional_diagnosis: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="initiated", index=True)
    initiated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    feedback_from_receiver: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    followup_required: Mapped[bool] = mapped_column(Boolean, default=False)
    followup_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class ReferralFollowup(BaseModel):
    __tablename__ = "referral_followups"

    referral_id: Mapped[str] = mapped_column(String(36), index=True)
    followup_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    conducted_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    beneficiary_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    treatment_compliance: Mapped[str | None] = mapped_column(String(30), nullable=True)
    complications: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    further_referral: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
