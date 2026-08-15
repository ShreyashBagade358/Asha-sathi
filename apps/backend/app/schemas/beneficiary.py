from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


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
    consent_given: bool = False
    consent_date: date | None = None
    consent_version: str | None = None
    abha_consent: bool = False


class HouseholdUpdate(BaseModel):
    village_id: str | None = None
    address: str | None = None
    address_local: dict[str, str] | None = None
    amenities: dict[str, Any] | None = None
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
    consent_given: bool
    consent_date: date | None = None
    consent_version: str | None = None
    abha_consent: bool
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
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    alternate_phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    marital_status: str | None = None
    blood_group: str | None = None
    religion: str | None = None
    caste_category: str | None = None
    education_level: str | None = None
    occupation: str | None = None
    is_pregnant: bool = False
    is_lactating: bool = False
    registration_date: date | None = None
    status: str = "active"


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
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    alternate_phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    marital_status: str | None = None
    blood_group: str | None = None
    education_level: str | None = None
    occupation: str | None = None
    is_pregnant: bool | None = None
    is_lactating: bool | None = None
    status: str | None = None


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
    registration_date: date | None = None
    status: str
    created_at: datetime
    village_id: str | None = None
    village: str | None = None
    asha_id: str | None = None


class BeneficiarySearchParams(BaseModel):
    q: str | None = None
    gender: str | None = None
    status: str | None = None
    village_id: str | None = None
    abha_id: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
