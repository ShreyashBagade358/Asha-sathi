from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class DeathReport(BaseModel):
    __tablename__ = "death_reports"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    death_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    death_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    place_of_death: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cause_of_death: Mapped[str | None] = mapped_column(String(255), nullable=True)
    icd10_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    verbal_autopsy_done: Mapped[bool] = mapped_column(Boolean, default=False)
    verbal_autopsy_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verbal_autopsy_findings: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    is_maternal_death: Mapped[bool] = mapped_column(Boolean, default=False)
    maternal_death_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pregnancy_outcome: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_child_death: Mapped[bool] = mapped_column(Boolean, default=False)
    child_age_days: Mapped[int | None]
    child_age_months: Mapped[int | None]
    reported_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="reported", index=True)
