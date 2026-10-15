from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# How a household member relates to the head. One shared vocabulary across the
# registration forms, the members list and the patient-facing family view.
RelationshipToHead = Literal["head", "spouse", "son", "daughter", "father", "mother", "grandparent", "other"]


class ConsentRecord(BaseModel):
    consent_given: bool = False
    consent_date: date | None = None
    consent_version: str | None = None
    abha_consent: bool = False


class HouseholdCreate(BaseModel):
    hhid: str = Field(min_length=3, max_length=64)
    village_id: str
    address: str | None = None
    address_local: dict[str, str] | None = None
    amenities: dict[str, Any] | None = None
    head_name: str | None = Field(default=None, min_length=1, max_length=200)
    ward: str | None = Field(default=None, max_length=100)
    family_size: int | None = Field(default=None, ge=0, le=99)
    contact_phone: str | None = Field(default=None, max_length=15)
    notes: str | None = Field(default=None, max_length=500)
    consent_given: bool = False
    consent_date: date | None = None
    consent_version: str | None = None
    abha_consent: bool = False


class HouseholdUpdate(BaseModel):
    village_id: str | None = None
    address: str | None = None
    address_local: dict[str, str] | None = None
    amenities: dict[str, Any] | None = None
    head_name: str | None = Field(default=None, min_length=1, max_length=200)
    ward: str | None = Field(default=None, max_length=100)
    family_size: int | None = Field(default=None, ge=0, le=99)
    contact_phone: str | None = Field(default=None, max_length=15)
    notes: str | None = Field(default=None, max_length=500)
    abha_consent: bool | None = None


class HouseholdResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    hhid: str
    village_id: str
    asha_id: str
    address: str | None = None
    address_local: dict[str, str] | None = None
    amenities: dict[str, Any] | None = None
    head_name: str | None = None
    ward: str | None = None
    family_size: int | None = None
    contact_phone: str | None = None
    notes: str | None = None
    consent_given: bool
    consent_date: date | None = None
    consent_version: str | None = None
    abha_consent: bool
    # Resolved/hydrated server-side — not columns on the household row.
    village: str | None = None
    member_count: int = 0
    eligible_women: int = 0
    children_under5: int = 0
    pregnant_women: int = 0
    created_at: datetime


class BeneficiaryCreate(BaseModel):
    beneficiary_id: str = Field(min_length=3, max_length=64)
    household_id: str | None = None
    abha_id: str | None = None
    abha_address: str | None = None
    rch_id: str | None = None
    aadhaar_hash: str | None = None
    full_name: str = Field(min_length=2, max_length=200)
    full_name_local: dict[str, str] | None = None
    gender: Literal["male", "female", "transgender", "other"] | None = None
    date_of_birth: date | None = None
    age_years: int | None = None
    age_months: int | None = None
    phone: str | None = Field(default=None, pattern=r"^\d{10}$")
    alternate_phone: str | None = Field(default=None, pattern=r"^\d{10}$")
    marital_status: str | None = None
    blood_group: str | None = None
    religion: str | None = None
    caste_category: str | None = None
    education_level: str | None = None
    occupation: str | None = None
    is_pregnant: bool = False
    is_lactating: bool = False
    relationship_to_head: RelationshipToHead | None = None
    registration_date: date | None = None
    status: str = "active"
    # Stored on `Beneficiary.metadata_json` — the model has no dedicated
    # columns for these, they are intake-time annotations.
    risk: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)
    village: str | None = Field(default=None, max_length=200)


class BeneficiaryUpdate(BaseModel):
    household_id: str | None = None
    abha_id: str | None = None
    abha_address: str | None = None
    rch_id: str | None = None
    full_name: str | None = None
    full_name_local: dict[str, str] | None = None
    gender: Literal["male", "female", "transgender", "other"] | None = None
    date_of_birth: date | None = None
    age_years: int | None = None
    age_months: int | None = None
    phone: str | None = Field(default=None, pattern=r"^\d{10}$")
    alternate_phone: str | None = Field(default=None, pattern=r"^\d{10}$")
    marital_status: str | None = None
    blood_group: str | None = None
    education_level: str | None = None
    occupation: str | None = None
    is_pregnant: bool | None = None
    is_lactating: bool | None = None
    relationship_to_head: RelationshipToHead | None = None
    status: str | None = None
    risk: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)
    village: str | None = Field(default=None, max_length=200)


class BeneficiaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    household_id: str | None = None
    abha_id: str | None = None
    abha_address: str | None = None
    rch_id: str | None = None
    full_name: str
    full_name_local: dict[str, str] | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    age_years: int | None = None
    age_months: int | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    marital_status: str | None = None
    blood_group: str | None = None
    is_pregnant: bool
    is_lactating: bool
    relationship_to_head: str | None = None
    registration_date: date | None = None
    status: str
    created_at: datetime
    village_id: str | None = None
    village: str | None = None
    asha_id: str | None = None
    # `risk`, `notes` and `village` are read back from `metadata_json` (see the
    # matching properties on the model); `photo_url` is a real column.
    risk: str | None = None
    notes: str | None = None
    photo_url: str | None = None


class BeneficiaryPhotoResponse(BaseModel):
    photo_url: str


class HouseholdMemberLink(BaseModel):
    """Optional relationship when linking an existing member into a household."""

    relationship_to_head: RelationshipToHead | None = None


# ---------------------------------------------------------------------------
# Household surveys
# ---------------------------------------------------------------------------
# What the ASHA observed for one family member during this visit. `concern`
# is the only non-default value a client needs to send: every checked member
# is recorded, so "ok" is simply "nothing to flag".
MemberCheckResult = Literal["ok", "concern"]


class MemberCheckCreate(BaseModel):
    beneficiary_id: str | None = Field(default=None, max_length=36)
    check_type: str = Field(default="general", max_length=40)
    result: MemberCheckResult = "ok"
    notes: str | None = Field(default=None, max_length=500)


class MemberCheckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    household_id: str
    survey_id: str | None = None
    beneficiary_id: str | None = None
    check_type: str
    result: MemberCheckResult
    notes: str | None = None
    visited_at: date | None = None
    created_at: datetime


class HouseholdSurveyCreate(BaseModel):
    answers: dict[str, Any] = Field(min_length=1)
    consent_obtained: bool = False
    visited_at: date | None = None
    member_checks: list[MemberCheckCreate] = Field(default_factory=list, max_length=100)


class HouseholdSurveyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    household_id: str
    answers: dict[str, Any]
    consent_obtained: bool
    visited_at: date | None = None
    created_at: datetime
    member_checks: list[MemberCheckResponse] = Field(default_factory=list)


class BeneficiarySearchParams(BaseModel):
    q: str | None = None
    gender: str | None = None
    status: str | None = None
    village_id: str | None = None
    abha_id: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
