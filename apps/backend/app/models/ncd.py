from datetime import date

from sqlalchemy import Boolean, Date, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class NCDScreening(BaseModel):
    __tablename__ = "ncd_screenings"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    screening_date: Mapped[date] = mapped_column(Date, index=True)

    age_above_30: Mapped[bool] = mapped_column(Boolean, default=False)
    tobacco_use: Mapped[bool] = mapped_column(Boolean, default=False)
    alcohol_use: Mapped[bool] = mapped_column(Boolean, default=False)
    physical_activity: Mapped[bool] = mapped_column(Boolean, default=True)
    waist_circumference_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    family_history_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    family_history_hypertension: Mapped[bool] = mapped_column(Boolean, default=False)
    family_history_cancer: Mapped[bool] = mapped_column(Boolean, default=False)
    known_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    known_hypertension: Mapped[bool] = mapped_column(Boolean, default=False)
    known_cancer: Mapped[bool] = mapped_column(Boolean, default=False)

    bp_systolic: Mapped[int | None]
    bp_diastolic: Mapped[int | None]
    blood_sugar_random: Mapped[float | None] = mapped_column(Float, nullable=True)

    cbac_score: Mapped[int | None]
    diabetes_risk: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hypertension_risk: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cardiovascular_risk: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cancer_risk: Mapped[str | None] = mapped_column(String(20), nullable=True)

    referral_made: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    referral_facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
