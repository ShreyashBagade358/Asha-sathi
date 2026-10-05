from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Pregnancy(BaseModel):
    __tablename__ = "pregnancies"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    lmp: Mapped[date | None] = mapped_column(Date, nullable=True)
    edd: Mapped[date | None] = mapped_column(Date, nullable=True)
    gravida: Mapped[int | None]
    parity: Mapped[int | None]
    abortions: Mapped[int | None]
    living_children: Mapped[int | None]
    risk_level: Mapped[str] = mapped_column(String(20), default="low", index=True)
    risk_factors: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_anc_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_anc_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    anc_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="ongoing", index=True)
    delivery_outcome_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class ANCVISIT(BaseModel):
    __tablename__ = "anc_visits"

    pregnancy_id: Mapped[str] = mapped_column(String(36), index=True)
    visit_number: Mapped[int] = mapped_column(Integer, default=1)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    bp_systolic: Mapped[int | None]
    bp_diastolic: Mapped[int | None]
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    pulse: Mapped[int | None]
    respiratory_rate: Mapped[int | None]
    spo2: Mapped[float | None] = mapped_column(Float, nullable=True)
    hemoglobin: Mapped[float | None] = mapped_column(Float, nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    rh_factor: Mapped[str | None] = mapped_column(String(16), nullable=True)
    blood_sugar_random: Mapped[float | None] = mapped_column(Float, nullable=True)
    blood_sugar_fasting: Mapped[float | None] = mapped_column(Float, nullable=True)
    hba1c: Mapped[float | None] = mapped_column(Float, nullable=True)
    urine_protein: Mapped[str | None] = mapped_column(String(20), nullable=True)
    urine_sugar: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hiv_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    syphilis_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hbsag_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fundal_height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    fetal_heart_rate: Mapped[int | None]
    fetal_movement: Mapped[str | None] = mapped_column(String(30), nullable=True)
    lie_presentation: Mapped[str | None] = mapped_column(String(30), nullable=True)
    danger_signs: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    clinical_findings: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    advice_given: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    referral_made: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    referred_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pmsma_attended: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class DeliveryOutcome(BaseModel):
    __tablename__ = "delivery_outcomes"

    pregnancy_id: Mapped[str] = mapped_column(String(36), index=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    place_of_delivery: Mapped[str | None] = mapped_column(String(50), nullable=True)
    delivery_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(30), nullable=True)
    birth_weight_grams: Mapped[int | None]
    birth_length_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    head_circumference_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    apgar_1min: Mapped[int | None]
    apgar_5min: Mapped[int | None]
    complications: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    maternal_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    newborn_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_notification_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class PNCVisit(BaseModel):
    __tablename__ = "pnc_visits"

    pregnancy_id: Mapped[str] = mapped_column(String(36), index=True)
    visit_number: Mapped[int] = mapped_column(Integer, default=1)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    bp_systolic: Mapped[int | None]
    bp_diastolic: Mapped[int | None]
    pulse: Mapped[int | None]
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    fundal_height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    bleeding_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    breast_condition: Mapped[str | None] = mapped_column(String(30), nullable=True)
    uterine_involution: Mapped[str | None] = mapped_column(String(30), nullable=True)
    danger_signs_mother: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    weight_grams: Mapped[int | None]
    temperature_newborn: Mapped[float | None] = mapped_column(Float, nullable=True)
    breastfeeding_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cord_care: Mapped[str | None] = mapped_column(String(30), nullable=True)
    danger_signs_newborn: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    referral_made: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class MicroBirthPlan(BaseModel):
    __tablename__ = "micro_birth_plans"

    pregnancy_id: Mapped[str] = mapped_column(String(36), index=True)
    preferred_delivery_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    transport_arranged: Mapped[bool] = mapped_column(Boolean, default=False)
    transport_details: Mapped[str | None] = mapped_column(String(255), nullable=True)
    blood_donor_arranged: Mapped[bool] = mapped_column(Boolean, default=False)
    blood_donor_details: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    companion_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    companion_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    funds_arranged: Mapped[bool] = mapped_column(Boolean, default=False)
    funds_source: Mapped[str | None] = mapped_column(String(200), nullable=True)
