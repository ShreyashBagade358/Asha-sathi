from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Eligible Couple
# ---------------------------------------------------------------------------
class EligibleCoupleCreate(BaseModel):
    husband_id: str | None = None
    wife_id: str
    registration_date: date | None = None
    status: str = "active"
    current_method: str | None = None
    method_start_date: date | None = None
    next_followup_date: date | None = None
    missed_period_tracked: bool = False
    last_missed_period_date: date | None = None
    pregnancy_confirmed: bool = False


class EligibleCoupleUpdate(BaseModel):
    status: str | None = None
    current_method: str | None = None
    method_start_date: date | None = None
    last_followup_date: date | None = None
    next_followup_date: date | None = None
    missed_period_tracked: bool | None = None
    last_missed_period_date: date | None = None
    pregnancy_confirmed: bool | None = None


class EligibleCoupleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    husband_id: str | None = None
    wife_id: str
    registration_date: date | None = None
    status: str
    current_method: str | None = None
    last_followup_date: date | None = None
    next_followup_date: date | None = None
    pregnancy_confirmed: bool


class ECFollowupCreate(BaseModel):
    followup_date: date
    method_used: str | None = None
    method_changed: bool = False
    previous_method: str | None = None
    side_effects: dict[str, Any] | None = None
    counseling_given: bool = False
    counseling_topics: dict[str, Any] | None = None
    referred_for_method: str | None = None
    referral_facility_id: str | None = None


class ECFollowupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ec_id: str
    followup_date: date
    method_used: str | None = None
    method_changed: bool
    side_effects: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# NCD
# ---------------------------------------------------------------------------
class NCDScreeningCreate(BaseModel):
    beneficiary_id: str
    screening_date: date
    age_above_30: bool = False
    tobacco_use: bool = False
    alcohol_use: bool = False
    physical_activity: bool = True
    waist_circumference_cm: float | None = None
    family_history_diabetes: bool = False
    family_history_hypertension: bool = False
    family_history_cancer: bool = False
    known_diabetes: bool = False
    known_hypertension: bool = False
    known_cancer: bool = False
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    blood_sugar_random: float | None = None
    cbac_score: int | None = None
    diabetes_risk: str | None = None
    hypertension_risk: str | None = None
    cardiovascular_risk: str | None = None
    cancer_risk: str | None = None
    referral_made: bool = False
    referral_type: str | None = None
    referral_facility_id: str | None = None


class NCDScreeningResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    screening_date: date
    cbac_score: int | None = None
    diabetes_risk: str | None = None
    hypertension_risk: str | None = None
    cardiovascular_risk: str | None = None
    cancer_risk: str | None = None
    referral_made: bool


# ---------------------------------------------------------------------------
# Disease
# ---------------------------------------------------------------------------
class DiseaseCaseCreate(BaseModel):
    disease_type: str
    beneficiary_id: str | None = None
    village_id: str | None = None
    detection_date: date | None = None
    detection_source: str | None = None
    symptoms: dict[str, Any] | None = None
    diagnosis_date: date | None = None
    diagnosis_method: str | None = None
    lab_confirmed: bool = False
    lab_facility_id: str | None = None
    treatment_started: bool = False
    treatment_start_date: date | None = None
    treatment_regimen: str | None = None
    treatment_completed: bool = False
    treatment_completion_date: date | None = None
    treatment_outcome: str | None = None
    mda_round: int | None = None
    mda_drug: str | None = None
    mda_dose: str | None = None
    side_effects: dict[str, Any] | None = None
    contacts_screened: int | None = None
    contacts_positive: int | None = None
    status: str = "suspected"


class DiseaseCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    disease_type: str
    beneficiary_id: str | None = None
    village_id: str | None = None
    detection_date: date | None = None
    diagnosis_date: date | None = None
    lab_confirmed: bool
    treatment_started: bool
    treatment_outcome: str | None = None
    status: str


# ---------------------------------------------------------------------------
# Death
# ---------------------------------------------------------------------------
class DeathReportCreate(BaseModel):
    beneficiary_id: str
    death_date: date | None = None
    death_time: datetime | None = None
    place_of_death: str | None = None
    cause_of_death: str | None = None
    icd10_code: str | None = None
    verbal_autopsy_done: bool = False
    verbal_autopsy_date: date | None = None
    verbal_autopsy_findings: dict[str, Any] | None = None
    is_maternal_death: bool = False
    maternal_death_type: str | None = None
    pregnancy_outcome: str | None = None
    is_child_death: bool = False
    child_age_days: int | None = None
    child_age_months: int | None = None


class DeathReportUpdate(BaseModel):
    cause_of_death: str | None = None
    icd10_code: str | None = None
    verbal_autopsy_done: bool | None = None
    verbal_autopsy_date: date | None = None
    verbal_autopsy_findings: dict[str, Any] | None = None
    status: str | None = None


class DeathReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    death_date: date | None = None
    place_of_death: str | None = None
    cause_of_death: str | None = None
    icd10_code: str | None = None
    is_maternal_death: bool
    is_child_death: bool
    status: str


# ---------------------------------------------------------------------------
# Tasks / KPI
# ---------------------------------------------------------------------------
class ASHATaskCreate(BaseModel):
    task_date: date | None = None
    task_type: str
    beneficiary_id: str | None = None
    household_id: str | None = None
    village_id: str | None = None
    priority: str = "medium"
    status: str = "pending"
    scheduled_time: datetime | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class ASHATaskUpdate(BaseModel):
    status: str | None = None
    completed_time: datetime | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    gps_accuracy: float | None = None
    notes: str | None = None


class ASHATaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asha_id: str
    task_date: date | None = None
    task_type: str
    beneficiary_id: str | None = None
    household_id: str | None = None
    village_id: str | None = None
    priority: str
    status: str
    scheduled_time: datetime | None = None
    completed_time: datetime | None = None
    notes: str | None = None


class ASHAKPIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asha_id: str
    period_start: date
    period_end: date | None = None
    period_type: str
    household_registered: int = 0
    beneficiary_registered: int = 0
    pregnancy_registered: int = 0
    anc_visits: int = 0
    pnc_visits: int = 0
    institutional_deliveries: int = 0
    home_deliveries: int = 0
    high_risk_pregnancies_identified: int = 0
    full_immunization_children: int = 0
    hbnc_visits: int = 0
    hbyc_visits: int = 0
    ncd_screenings: int = 0
    ncd_positive_referred: int = 0
    incentives_earned: int = 0
    performance_score: float | None = None


# ---------------------------------------------------------------------------
# Incentive
# ---------------------------------------------------------------------------
class IncentiveClaimCreate(BaseModel):
    claim_month: str = Field(pattern=r"^\d{4}-\d{2}$")
    claim_period_start: date | None = None
    claim_period_end: date | None = None


class IncentiveClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asha_id: str
    claim_month: str
    activities: dict[str, Any] | None = None
    total_amount: float | None = None
    status: str
    pdf_url: str | None = None
    submitted_at: datetime | None = None
    approved_amount: float | None = None
    paid_at: datetime | None = None


class VillageFormCreate(BaseModel):
    form_type: str
    form_date: date | None = None
    village_id: str | None = None
    form_data: dict[str, Any] | None = None


class VillageFormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asha_id: str
    form_type: str
    form_date: date | None = None
    village_id: str | None = None
    status: str
    incentive_eligible: bool
    incentive_amount: float | None = None


# ---------------------------------------------------------------------------
# ABHA / Health Records
# ---------------------------------------------------------------------------
class ABHACreate(BaseModel):
    beneficiary_id: str
    creation_method: Literal["aadhaar", "mobile", "driving_license", "abha_address"] = "aadhaar"
    linked_mobile: str | None = None
    linked_email: str | None = None


class ABHAResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    abha_number: str
    abha_address: str
    kyc_status: str
    consent_status: str
    demographic_verified: bool


class HealthRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    abha_record_id: str
    record_type: str
    document_id: str
    encounter_date: datetime | None = None
    status: str
    visibility: str


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationCreate(BaseModel):
    user_id: str
    type: str
    priority: str = "normal"
    title: str
    title_local: dict[str, str] | None = None
    message: str
    message_local: dict[str, str] | None = None
    action_url: str | None = None
    action_label: str | None = None
    reference_id: str | None = None
    reference_type: str | None = None
    channels: list[str] | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type: str
    priority: str
    title: str
    message: str
    action_url: str | None = None
    status: str
    read_at: datetime | None = None
    created_at: datetime


class BroadcastCreate(BaseModel):
    roles: list[str] | None = None
    title: str
    message: str
    channels: list[str] = ["push"]


class ReminderScheduleCreate(BaseModel):
    beneficiary_id: str
    reminder_type: str
    due_date: date | None = None
    due_time: datetime | None = None
    frequency: str | None = None
    frequency_config: dict[str, Any] | None = None
    message_template: str | None = None
    channels: list[str] | None = None


class ReminderScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    reminder_type: str
    due_date: date | None = None
    frequency: str | None = None
    is_active: bool
    next_send_at: datetime | None = None


# ---------------------------------------------------------------------------
# Referrals
# ---------------------------------------------------------------------------
class ReferralCreate(BaseModel):
    beneficiary_id: str
    referred_to_facility_id: str | None = None
    referred_to_specialist_id: str | None = None
    referral_type: str
    urgency: str = "routine"
    reason: str | None = None
    clinical_summary: dict[str, Any] | None = None
    investigations: dict[str, Any] | None = None
    provisional_diagnosis: str | None = None
    followup_required: bool = False
    followup_date: date | None = None


class ReferralUpdate(BaseModel):
    outcome: str | None = None
    feedback_from_receiver: dict[str, Any] | None = None
    followup_required: bool | None = None
    followup_date: date | None = None


class ReferralResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    referred_to_facility_id: str | None = None
    referral_type: str
    urgency: str
    reason: str | None = None
    provisional_diagnosis: str | None = None
    status: str
    initiated_at: datetime | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    outcome: str | None = None


class ReferralFollowupCreate(BaseModel):
    followup_date: date | None = None
    beneficiary_status: str | None = None
    treatment_compliance: str | None = None
    complications: dict[str, Any] | None = None
    further_referral: bool = False
    notes: str | None = None


class ReferralFollowupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referral_id: str
    followup_date: date | None = None
    beneficiary_status: str | None = None
    treatment_compliance: str | None = None
    further_referral: bool
    notes: str | None = None


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
class MaternalRiskRequest(BaseModel):
    beneficiary_id: str
    age: int | None = None
    gravida: int | None = None
    parity: int | None = None
    lmp_days_ago: int | None = None
    hemoglobin: float | None = None
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    weight_kg: float | None = None
    previous_csection: bool = False
    previous_miscarriages: int | None = None
    multiple_pregnancy: bool = False
    has_risk_factors: bool = False


class ChildGrowthRequest(BaseModel):
    beneficiary_id: str
    age_months: int | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    muac_mm: float | None = None
    birth_weight_grams: int | None = None
    breastfeeding: str | None = None


class NCDRiskRequest(BaseModel):
    beneficiary_id: str
    age: int | None = None
    tobacco_use: bool = False
    alcohol_use: bool = False
    waist_circumference_cm: float | None = None
    family_history_diabetes: bool = False
    family_history_hypertension: bool = False
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    blood_sugar_random: float | None = None


class AIPredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    model_name: str
    model_version: str | None = None
    prediction: dict[str, Any] | None = None
    confidence: float | None = None
    explanation: dict[str, Any] | None = None
    created_at: datetime


class ModelInfo(BaseModel):
    name: str
    version: str
    status: str = "available"


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
class SyncOperationItem(BaseModel):
    """A single client-side change queued for upload.

    `client_request_id` is the idempotency key: a device-generated UUID recorded
    once per logical change. If the server already processed it (retry, app
    restart, duplicate batch), the stored response is replayed and no duplicate
    record is created.
    """

    client_request_id: str = Field(min_length=1, max_length=64)
    entity: str = Field(min_length=1, max_length=60)
    operation: Literal["create", "update", "delete"]
    id: str = Field(min_length=1, max_length=64)
    version: int = Field(default=1, ge=0)
    data: dict[str, Any] = Field(default_factory=dict)
    deleted_at: str | None = None


class SyncPushRequest(BaseModel):
    device_id: str | None = None
    app_version: str | None = None
    records: dict[str, list[dict[str, Any]]] | None = None
    # Legacy(optional) path. Preferred: explicit operations with idempotency keys.
    operations: list[SyncOperationItem] | None = None


class SyncPushItemResult(BaseModel):
    client_request_id: str | None = None
    entity: str
    operation: str
    status: Literal["success", "failed", "conflict"]
    server_id: str | None = None
    version: int | None = None
    error: str | None = None
    conflict_reason: str | None = None
    # Server-side snapshot for the affected record (used for conflict review + pull)
    record: dict[str, Any] | None = None


class SyncPushResponse(BaseModel):
    results: list[SyncPushItemResult]
    server_time: datetime
    summary: dict[str, int]


class SyncPullRequest(BaseModel):
    device_id: str | None = None
    last_pull_at: datetime
    tables: list[str] | None = None


class SyncPullResponse(BaseModel):
    records: dict[str, list[dict[str, Any]]]
    server_time: datetime


class SyncConflictResolveRequest(BaseModel):
    table: str
    record_id: str
    server_values: dict[str, Any] | None = None
    client_values: dict[str, Any] | None = None
    resolution: Literal["server_wins", "client_wins", "merge"]


class SyncStatusResponse(BaseModel):
    online: bool = True
    last_sync_at: datetime | None = None
    pending_push: int = 0
    pending_pull: int = 0
    conflicts: int = 0


class DeviceRegisterRequest(BaseModel):
    """Register (or refresh) this device's push capability with the backend."""

    device_id: str = Field(min_length=1, max_length=128)
    app_version: str | None = None
    platform: str | None = None
    fcm_token: str | None = Field(default=None, max_length=512)


class DeviceRegisterResponse(BaseModel):
    device_id: str
    registered: bool
    server_time: datetime


# ---------------------------------------------------------------------------
# Dashboard KPI
# ---------------------------------------------------------------------------
class DashboardKPI(BaseModel):
    key: str
    label: str
    value: float
    delta: float | None = None
    unit: str | None = None
