from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Household(BaseModel):
    __tablename__ = "households"

    hhid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    village_id: Mapped[str] = mapped_column(String(36), index=True)
    asha_id: Mapped[str] = mapped_column(String(36), index=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    amenities: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    # Household demographics captured by the registration form. All nullable so
    # rows created before these existed (and the sync path) keep working.
    head_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ward: Mapped[str | None] = mapped_column(String(100), nullable=True)
    family_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    consent_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    abha_consent: Mapped[bool] = mapped_column(Boolean, default=False)


class HouseholdVisitCheck(BaseModel):
    """One family member's status recorded during a household visit.

    The offline sync layer writes these directly, so the three link columns are
    bare strings with no FK: a push that arrives before (or without) the rows
    it references must not fail the batch. Rows created by
    `POST /households/{id}/survey` do carry a real `survey_id`.
    """

    __tablename__ = "household_visit_checks"

    household_id: Mapped[str] = mapped_column(String(36), index=True)
    survey_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    beneficiary_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    check_type: Mapped[str] = mapped_column(String(40), default="general", index=True)
    result: Mapped[str] = mapped_column(String(20), default="ok")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    visited_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)


class HouseholdSurvey(BaseModel):
    """One administered household survey.

    `households` has no metadata column to hang these on, so each submission is
    its own row — the survey answers are immutable after creation.
    """

    __tablename__ = "household_surveys"

    household_id: Mapped[str] = mapped_column(String(36), ForeignKey("households.id"), index=True)
    asha_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    consent_obtained: Mapped[bool] = mapped_column(Boolean, default=False)
    visited_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    photo_urls: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class Beneficiary(BaseModel):
    __tablename__ = "beneficiaries"

    beneficiary_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    household_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    abha_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    abha_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rch_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    aadhaar_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    full_name: Mapped[str] = mapped_column(String(200), index=True)
    full_name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_years: Mapped[int | None]
    age_months: Mapped[int | None]
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    marital_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    religion: Mapped[str | None] = mapped_column(String(30), nullable=True)
    caste_category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    education_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(60), nullable=True)

    is_pregnant: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lactating: Mapped[bool] = mapped_column(Boolean, default=False)

    # How this member relates to the household head (`head`, `spouse`, `son`,
    # ...). Nullable: rows created before this existed, and pushes from older
    # clients, simply carry no relationship.
    relationship_to_head: Mapped[str | None] = mapped_column(String(30), nullable=True)

    registration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    registered_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, default=dict)

    # `risk`, `notes` and `village` are intake annotations with no dedicated
    # columns — they live in `metadata_json`. Exposing them as properties means
    # every `BeneficiaryResponse.model_validate(...)` call site (create, search,
    # household members, timeline) reads them back the same way, and the
    # declarative constructor accepts them as keyword arguments.
    @property
    def risk(self) -> str | None:
        return (self.metadata_json or {}).get("risk")

    @risk.setter
    def risk(self, value: str | None) -> None:
        self._set_metadata_entry("risk", value)

    @property
    def notes(self) -> str | None:
        return (self.metadata_json or {}).get("notes")

    @notes.setter
    def notes(self, value: str | None) -> None:
        self._set_metadata_entry("notes", value)

    @property
    def village(self) -> str | None:
        return (self.metadata_json or {}).get("village")

    @village.setter
    def village(self, value: str | None) -> None:
        self._set_metadata_entry("village", value)

    def _set_metadata_entry(self, key: str, value: Any) -> None:
        metadata = dict(self.metadata_json or {})
        metadata[key] = value
        self.metadata_json = metadata
