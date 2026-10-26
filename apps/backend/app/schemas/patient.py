from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.beneficiary import RelationshipToHead

_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}


class PatientRegistrationRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(pattern=r"^\d{10}$")
    date_of_birth: date
    gender: Literal["male", "female", "other"]
    abha_id: str = Field(min_length=4, max_length=64)
    village: str | None = Field(default=None, max_length=100)
    # Geography recorded at intake (mirrors the mobile form's required
    # state / district selects); stored on Beneficiary.metadata_json.
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    household_id: str | None = Field(default=None, max_length=64)
    # Relationship of this patient to the household head (family linking).
    relationship_to_head: RelationshipToHead | None = None
    blood_group: str | None = Field(default=None, max_length=10)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    # Intake annotations. Persisted on `Beneficiary.metadata_json` (keys
    # `asha_worker` / `risk`) and `metadata_json["notes"]` — the beneficiary
    # model has no dedicated columns for them.
    asha_worker: str | None = Field(default=None, max_length=200)
    risk: str | None = None
    notes: str | None = None

    @field_validator("blood_group", mode="before")
    @classmethod
    def _normalize_blood_group(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().upper()
        if not normalized:
            return None
        if normalized not in _BLOOD_GROUPS:
            raise ValueError("Must be one of A+, A-, B+, B-, AB+, AB-, O+, O-")
        return normalized


class PatientRegistrationResponse(BaseModel):
    user_id: str
    beneficiary_id: str
    phone: str
    full_name: str
    # Plaintext, returned exactly once at registration so the ASHA worker can
    # hand it to the patient. Never retrievable again.
    password: str


class PregnancySummary(BaseModel):
    lmp: date | None = None
    edd: date | None = None
    anc_visits: int = 0
    risk_level: str = "low"
    high_risk: bool = False
    trimester: int | None = None
    week: int | None = None


class PatientVitals(BaseModel):
    height_cm: float | None = None
    weight_kg: float | None = None
    bmi: float | None = None
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse: int | None = None
    temperature: float | None = None
    spo2: int | None = None
    hemoglobin: float | None = None
    blood_sugar_random: float | None = None
    waist_circumference_cm: float | None = None
    blood_group: str | None = None


class PatientProfileUpdate(BaseModel):
    """Everything the patient may edit about their own screening inputs.

    All fields optional: only the ones actually sent are merged into
    `Beneficiary.metadata_json["profile_inputs"]`, everything already stored
    there is preserved.
    """

    height_cm: float | None = Field(default=None, ge=50, le=250)
    weight_kg: float | None = Field(default=None, ge=2, le=400)
    bp_systolic: int | None = Field(default=None, ge=50, le=260)
    bp_diastolic: int | None = Field(default=None, ge=30, le=160)
    blood_sugar_random: float | None = Field(default=None, ge=0, le=1000)
    waist_circumference_cm: float | None = Field(default=None, ge=30, le=250)
    hemoglobin: float | None = Field(default=None, ge=1, le=25)
    tobacco_use: bool | None = None
    alcohol_use: bool | None = None
    physical_activity: Literal["low", "moderate", "high"] | None = None
    family_history_diabetes: bool | None = None
    family_history_hypertension: bool | None = None
    known_diabetes: bool | None = None
    known_hypertension: bool | None = None
    gravida: int | None = Field(default=None, ge=1, le=20)
    parity: int | None = Field(default=None, ge=0, le=20)
    previous_csection: bool | None = None
    previous_miscarriages: bool | None = None
    previous_pph: bool | None = None
    previous_preterm: bool | None = None
    previous_stillbirth: bool | None = None
    multiple_pregnancy: bool | None = None


class PatientHouseholdMember(BaseModel):
    """One family member as the signed-in patient may see them.

    Demographics only — no phone, ABHA id or clinical history: the family view
    answers "who lives here", not "what is wrong with them".
    """

    id: str
    full_name: str
    gender: str | None = None
    age_years: int | None = None
    age_months: int | None = None
    # Plain str, not `RelationshipToHead`: a row written by an older client can
    # carry a value outside the vocabulary, and a family view must not 500 on it.
    relationship_to_head: str | None = None
    marital_status: str | None = None
    is_pregnant: bool = False
    is_lactating: bool = False
    is_self: bool = False


class PatientHouseholdResponse(BaseModel):
    """The patient's own household: its demographics plus the family roll."""

    id: str
    hhid: str
    head_name: str | None = None
    ward: str | None = None
    address: str | None = None
    village: str | None = None
    family_size: int | None = None
    contact_phone: str | None = None
    member_count: int = 0
    members: list[PatientHouseholdMember] = Field(default_factory=list)


class PatientProfileResponse(BaseModel):
    """Everything the signed-in patient is allowed to see about themselves.

    Resolved server-side from User -> Beneficiary (matched on phone, the only
    link that exists) -> registered_by -> PHC, so the client never has to walk
    relationships it cannot query.
    """

    user_id: str
    beneficiary_id: str | None = None
    full_name: str
    phone: str
    abha_id: str | None = None
    date_of_birth: date | None = None
    age_years: int | None = None
    gender: str | None = None
    blood_group: str | None = None
    village: str | None = None
    household_id: str | None = None
    address: str | None = None
    phc_name: str | None = None
    asha_worker_name: str | None = None
    # Stored on the beneficiary's metadata: `asha_worker` / `risk` keys plus
    # `notes` (the beneficiary model has no `notes` column).
    asha_worker: str | None = None
    risk: str | None = None
    notes: str | None = None
    # Raw slice written by `PUT /patients/me` — the inputs the ML readback and
    # the vitals fallback are derived from.
    profile_inputs: dict[str, Any] | None = None
    is_pregnant: bool = False
    active_conditions: list[str] = Field(default_factory=list)
    pregnancy: PregnancySummary | None = None
    vitals: PatientVitals | None = None


class AppointmentRequestCreate(BaseModel):
    """Patient-initiated appointment request, delivered as an ASHA task."""

    reason: str = Field(min_length=2, max_length=200)
    preferred_date: date
    preferred_time: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


class AppointmentRequestResponse(BaseModel):
    id: str
    reason: str
    preferred_date: date
    preferred_time: str | None = None
    notes: str | None = None
    status: str
    asha_worker_name: str | None = None
    created_at: str | None = None


class ReferralRequestCreate(BaseModel):
    """Patient-initiated referral request, delivered as a Referral row + ASHA notification."""

    referral_type: str = Field(min_length=2, max_length=40)
    urgency: Literal["routine", "urgent", "emergency"] = "routine"
    reason: str = Field(min_length=2, max_length=500)
    referred_to_facility_id: str | None = Field(default=None, max_length=36)


class ReferralRequestResponse(BaseModel):
    id: str
    referral_type: str
    urgency: str
    reason: str
    status: str
    asha_worker_name: str | None = None
    created_at: str | None = None


class PregnancyReportCreate(BaseModel):
    """Patient-initiated pregnancy report.

    LMP is the only clinical input the patient supplies; EDD is derived
    server-side (Naegele's rule: LMP + 280 days) so the patient cannot
    mis-set it. Gravida/parity are optional self-reported history.
    """

    lmp: date
    gravida: int | None = Field(default=None, ge=0, le=20)
    parity: int | None = Field(default=None, ge=0, le=20)
    notes: str | None = Field(default=None, max_length=500)


class PregnancyReportResponse(BaseModel):
    id: str
    lmp: date
    edd: date
    gravida: int | None = None
    parity: int | None = None
    status: str
    asha_worker_name: str | None = None
    created_at: str | None = None
