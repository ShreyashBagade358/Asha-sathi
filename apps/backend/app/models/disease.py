from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class DiseaseCase(BaseModel):
    __tablename__ = "disease_cases"

    disease_type: Mapped[str] = mapped_column(String(40), index=True)
    beneficiary_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    village_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    detection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    detection_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    symptoms: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    diagnosis_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    diagnosis_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    lab_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    lab_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    treatment_started: Mapped[bool] = mapped_column(Boolean, default=False)
    treatment_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    treatment_regimen: Mapped[str | None] = mapped_column(String(120), nullable=True)
    treatment_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    treatment_completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    treatment_outcome: Mapped[str | None] = mapped_column(String(40), nullable=True)
    mda_round: Mapped[int | None]
    mda_drug: Mapped[str | None] = mapped_column(String(40), nullable=True)
    mda_dose: Mapped[str | None] = mapped_column(String(40), nullable=True)
    side_effects: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    contacts_screened: Mapped[int | None]
    contacts_positive: Mapped[int | None]
    status: Mapped[str] = mapped_column(String(30), default="suspected", index=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class MalariaCase(BaseModel):
    """One-to-one detail row for a malaria DiseaseCase.

    ``disease_case_id`` used to be declared ``primary_key=True`` alongside
    BaseModel's ``id``, which created a bogus composite primary key. It is a
    unique foreign key instead — the row is identified by ``id`` and joins to
    ``disease_cases`` through ``disease_case_id``.
    """

    __tablename__ = "malaria_cases"

    disease_case_id: Mapped[str] = mapped_column(String(36), ForeignKey("disease_cases.id"), unique=True, index=True)
    species: Mapped[str | None] = mapped_column(String(40), nullable=True)
    parasite_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    rdt_result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    microscopy_result: Mapped[str | None] = mapped_column(String(40), nullable=True)
    severe_malaria: Mapped[bool] = mapped_column(Boolean, default=False)
    severe_signs: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    injectable_artesunate_given: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_for_severe: Mapped[bool] = mapped_column(Boolean, default=False)


class TBCase(BaseModel):
    """One-to-one detail row for a TB DiseaseCase (same pattern as MalariaCase)."""

    __tablename__ = "tb_cases"

    disease_case_id: Mapped[str] = mapped_column(String(36), ForeignKey("disease_cases.id"), unique=True, index=True)
    tb_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    site_extrapulmonary: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bacteriologically_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    cbnaat_result: Mapped[str | None] = mapped_column(String(40), nullable=True)
    drug_resistance_test: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dr_tb_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hiv_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    diabetes_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    treatment_category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    regimen: Mapped[str | None] = mapped_column(String(120), nullable=True)
    nikshay_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    nikshay_registered: Mapped[bool] = mapped_column(Boolean, default=False)
