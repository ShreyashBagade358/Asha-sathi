from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class IncentiveClaim(BaseModel):
    __tablename__ = "incentive_claims"
    __table_args__ = (UniqueConstraint("asha_id", "claim_month", name="uq_incentive_claim_month"),)

    asha_id: Mapped[str] = mapped_column(String(36), index=True)
    claim_month: Mapped[str] = mapped_column(String(7), index=True)
    claim_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    claim_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    activities: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approved_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)


class VillageForm(BaseModel):
    __tablename__ = "village_forms"

    asha_id: Mapped[str] = mapped_column(String(36), index=True)
    form_type: Mapped[str] = mapped_column(String(40), index=True)
    form_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    village_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    form_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    incentive_eligible: Mapped[bool] = mapped_column(default=False)
    incentive_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
