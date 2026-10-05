from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, Float, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Child(BaseModel):
    __tablename__ = "children"

    beneficiary_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    birth_registration_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    birth_weight_grams: Mapped[int | None]
    birth_length_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    head_circumference_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    gestation_weeks: Mapped[int | None]
    delivery_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    place_of_birth: Mapped[str | None] = mapped_column(String(50), nullable=True)
    apgar_1min: Mapped[int | None]
    apgar_5min: Mapped[int | None]
    congenital_anomalies: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)


class Immunization(BaseModel):
    __tablename__ = "immunizations"
    __table_args__ = (UniqueConstraint("child_id", "vaccine_code", "dose_number", name="uq_immunization_dose"),)

    child_id: Mapped[str] = mapped_column(String(36), index=True)
    vaccine_code: Mapped[str] = mapped_column(String(20), index=True)
    vaccine_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    dose_number: Mapped[int] = mapped_column(Integer, default=1)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    given_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="due", index=True)
    given_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    batch_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    route: Mapped[str | None] = mapped_column(String(20), nullable=True)
    site: Mapped[str | None] = mapped_column(String(20), nullable=True)
    adverse_event: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class HBNCVisit(BaseModel):
    __tablename__ = "hbnc_visits"

    child_id: Mapped[str] = mapped_column(String(36), index=True)
    visit_number: Mapped[int] = mapped_column(Integer, default=1)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    weight_grams: Mapped[int | None]
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    breastfeeding_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cord_condition: Mapped[str | None] = mapped_column(String(30), nullable=True)
    skin_condition: Mapped[str | None] = mapped_column(String(30), nullable=True)
    danger_signs: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    referral_made: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class HBYCVisit(BaseModel):
    __tablename__ = "hbyc_visits"

    child_id: Mapped[str] = mapped_column(String(36), index=True)
    visit_number: Mapped[int] = mapped_column(Integer, default=1)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    age_months: Mapped[int | None]
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    muac_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_score_wfa: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_score_hfa: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_score_wfh: Mapped[float | None] = mapped_column(Float, nullable=True)
    nutrition_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    developmental_milestones: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    danger_signs: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    referral_made: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class GrowthRecord(BaseModel):
    __tablename__ = "growth_records"

    child_id: Mapped[str] = mapped_column(String(36), index=True)
    record_date: Mapped[date] = mapped_column(Date, index=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    muac_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_score_wfa: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    z_score_hfa: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    z_score_wfh: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    nutrition_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
