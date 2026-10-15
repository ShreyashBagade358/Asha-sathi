from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class EligibleCouple(BaseModel):
    __tablename__ = "eligible_couples"

    husband_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    wife_id: Mapped[str] = mapped_column(String(36), index=True)
    registration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    current_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    method_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_followup_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_followup_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    missed_period_tracked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_missed_period_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pregnancy_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    pregnancy_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("pregnancies.id"), nullable=True, index=True
    )
    registered_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class ECFollowup(BaseModel):
    __tablename__ = "ec_followups"

    ec_id: Mapped[str] = mapped_column(String(36), index=True)
    followup_date: Mapped[date] = mapped_column(Date, index=True)
    method_used: Mapped[str | None] = mapped_column(String(40), nullable=True)
    method_changed: Mapped[bool] = mapped_column(Boolean, default=False)
    previous_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    side_effects: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    counseling_given: Mapped[bool] = mapped_column(Boolean, default=False)
    counseling_topics: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    referred_for_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    referral_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
