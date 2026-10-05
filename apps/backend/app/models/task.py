from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class ASHATask(BaseModel):
    __tablename__ = "asha_tasks"
    __table_args__ = (
        Index("uq_asha_tasks_day_household_type", "asha_id", "task_date", "household_id", "task_type", unique=True),
    )

    asha_id: Mapped[str] = mapped_column(String(36), index=True)
    task_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    task_type: Mapped[str] = mapped_column(String(50), index=True)
    beneficiary_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    household_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    village_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gps_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, default=dict)


class ASHAKPI(BaseModel):
    __tablename__ = "asha_kpis"
    __table_args__ = (UniqueConstraint("asha_id", "period_start", "period_type", name="uq_asha_kpi_period"),)

    asha_id: Mapped[str] = mapped_column(String(36), index=True)
    period_start: Mapped[date] = mapped_column(Date, index=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_type: Mapped[str] = mapped_column(String(20), default="monthly")

    household_registered: Mapped[int] = mapped_column(Integer, default=0)
    beneficiary_registered: Mapped[int] = mapped_column(Integer, default=0)
    pregnancy_registered: Mapped[int] = mapped_column(Integer, default=0)
    anc_visits: Mapped[int] = mapped_column(Integer, default=0)
    pnc_visits: Mapped[int] = mapped_column(Integer, default=0)
    institutional_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    home_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    high_risk_pregnancies_identified: Mapped[int] = mapped_column(Integer, default=0)
    high_risk_pregnancies_referred: Mapped[int] = mapped_column(Integer, default=0)
    deliveries_birth_preparedness: Mapped[int] = mapped_column(Integer, default=0)
    live_births: Mapped[int] = mapped_column(Integer, default=0)
    stillbirths: Mapped[int] = mapped_column(Integer, default=0)
    birth_registrations: Mapped[int] = mapped_column(Integer, default=0)
    hbnc_visits: Mapped[int] = mapped_column(Integer, default=0)
    hbyc_visits: Mapped[int] = mapped_column(Integer, default=0)
    children_immunized_bcg: Mapped[int] = mapped_column(Integer, default=0)
    children_immunized_opol: Mapped[int] = mapped_column(Integer, default=0)
    children_immunized_penta: Mapped[int] = mapped_column(Integer, default=0)
    children_immunized_mr: Mapped[int] = mapped_column(Integer, default=0)
    children_immunized_vitamin_a: Mapped[int] = mapped_column(Integer, default=0)
    full_immunization_children: Mapped[int] = mapped_column(Integer, default=0)
    growth_monitoring_done: Mapped[int] = mapped_column(Integer, default=0)
    sam_children_identified: Mapped[int] = mapped_column(Integer, default=0)
    mam_children_identified: Mapped[int] = mapped_column(Integer, default=0)
    ec_registered: Mapped[int] = mapped_column(Integer, default=0)
    ec_followups: Mapped[int] = mapped_column(Integer, default=0)
    contraceptives_distributed: Mapped[int] = mapped_column(Integer, default=0)
    ncd_screenings: Mapped[int] = mapped_column(Integer, default=0)
    ncd_positive_referred: Mapped[int] = mapped_column(Integer, default=0)
    cbac_screenings: Mapped[int] = mapped_column(Integer, default=0)
    fever_screenings: Mapped[int] = mapped_column(Integer, default=0)
    malaria_suspects_referred: Mapped[int] = mapped_column(Integer, default=0)
    tb_suspects_referred: Mapped[int] = mapped_column(Integer, default=0)
    village_health_sanitation_days: Mapped[int] = mapped_column(Integer, default=0)
    village_health_nutrition_days: Mapped[int] = mapped_column(Integer, default=0)
    maternal_deaths_reported: Mapped[int] = mapped_column(Integer, default=0)
    child_deaths_reported: Mapped[int] = mapped_column(Integer, default=0)
    eligible_claims_submitted: Mapped[int] = mapped_column(Integer, default=0)
    incentives_earned: Mapped[int] = mapped_column(Integer, default=0)
    sync_successful: Mapped[int] = mapped_column(Integer, default=0)
    sync_failed: Mapped[int] = mapped_column(Integer, default=0)

    performance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
