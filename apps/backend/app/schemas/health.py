from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

RiskLevel = Literal["low", "medium", "high"]


class PregnancyCreate(BaseModel):
    beneficiary_id: str
    lmp: date | None = None
    edd: date | None = None
    gravida: int | None = Field(default=None, ge=0)
    parity: int | None = Field(default=None, ge=0)
    abortions: int | None = Field(default=None, ge=0)
    living_children: int | None = Field(default=None, ge=0)
    risk_level: RiskLevel = "low"
    risk_factors: dict[str, Any] | None = None
    risk_score: float | None = None
    status: str = "ongoing"


class PregnancyUpdate(BaseModel):
    lmp: date | None = None
    edd: date | None = None
    gravida: int | None = Field(default=None, ge=0)
    parity: int | None = Field(default=None, ge=0)
    abortions: int | None = Field(default=None, ge=0)
    living_children: int | None = Field(default=None, ge=0)
    risk_level: RiskLevel | None = None
    risk_factors: dict[str, Any] | None = None
    risk_score: float | None = None
    last_anc_date: date | None = None
    next_anc_due: date | None = None
    anc_count: int | None = None
    status: str | None = None


class PregnancyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    lmp: date | None = None
    edd: date | None = None
    gravida: int | None = None
    parity: int | None = None
    abortions: int | None = None
    living_children: int | None = None
    risk_level: str
    risk_factors: dict[str, Any] | None = None
    risk_score: float | None = None
    last_anc_date: date | None = None
    next_anc_due: date | None = None
    anc_count: int
    status: str
    created_at: datetime


class ANCVisitCreate(BaseModel):
    visit_number: int = 1
    visit_date: date
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    bmi: float | None = None
    temperature: float | None = None
    pulse: int | None = None
    respiratory_rate: int | None = None
    spo2: float | None = None
    hemoglobin: float | None = None
    blood_group: str | None = None
    rh_factor: str | None = None
    blood_sugar_random: float | None = None
    blood_sugar_fasting: float | None = None
    hba1c: float | None = None
    urine_protein: str | None = None
    urine_sugar: str | None = None
    hiv_status: str | None = None
    syphilis_status: str | None = None
    hbsag_status: str | None = None
    fundal_height_cm: float | None = None
    fetal_heart_rate: int | None = None
    fetal_movement: str | None = None
    lie_presentation: str | None = None
    danger_signs: dict[str, Any] | None = None
    clinical_findings: dict[str, Any] | None = None
    advice_given: dict[str, Any] | None = None
    referral_made: bool = False
    referral_reason: str | None = None
    referred_facility_id: str | None = None
    pmsma_attended: bool = False


class ANCVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pregnancy_id: str
    visit_number: int
    visit_date: date
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    weight_kg: float | None = None
    hemoglobin: float | None = None
    danger_signs: dict[str, Any] | None = None
    referral_made: bool
    referral_reason: str | None = None
    created_at: datetime


class DeliveryOutcomeCreate(BaseModel):
    delivery_date: date | None = None
    delivery_time: datetime | None = None
    place_of_delivery: str | None = None
    delivery_type: str | None = None
    outcome: str | None = None
    birth_weight_grams: int | None = None
    birth_length_cm: float | None = None
    head_circumference_cm: float | None = None
    apgar_1min: int | None = None
    apgar_5min: int | None = None
    complications: dict[str, Any] | None = None
    maternal_condition: str | None = None
    newborn_condition: str | None = None
    birth_notification_no: str | None = None


class DeliveryOutcomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pregnancy_id: str
    delivery_date: date | None = None
    place_of_delivery: str | None = None
    delivery_type: str | None = None
    outcome: str | None = None
    birth_weight_grams: int | None = None
    complications: dict[str, Any] | None = None
    birth_notification_no: str | None = None


class PNCVisitCreate(BaseModel):
    visit_number: int = 1
    visit_date: date
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse: int | None = None
    temperature: float | None = None
    weight_kg: float | None = None
    fundal_height_cm: float | None = None
    bleeding_status: str | None = None
    breast_condition: str | None = None
    uterine_involution: str | None = None
    danger_signs_mother: dict[str, Any] | None = None
    weight_grams: int | None = None
    temperature_newborn: float | None = None
    breastfeeding_status: str | None = None
    cord_care: str | None = None
    danger_signs_newborn: dict[str, Any] | None = None
    referral_made: bool = False
    referral_reason: str | None = None


class PNCVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pregnancy_id: str
    visit_number: int
    visit_date: date
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    danger_signs_mother: dict[str, Any] | None = None
    breastfeeding_status: str | None = None
    referral_made: bool
    created_at: datetime


class MicroBirthPlanCreate(BaseModel):
    preferred_delivery_facility_id: str | None = None
    transport_arranged: bool = False
    transport_details: str | None = None
    blood_donor_arranged: bool = False
    blood_donor_details: dict[str, Any] | None = None
    companion_name: str | None = None
    companion_phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    funds_arranged: bool = False
    funds_source: str | None = None


class MicroBirthPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pregnancy_id: str
    preferred_delivery_facility_id: str | None = None
    transport_arranged: bool
    blood_donor_arranged: bool
    companion_name: str | None = None
    funds_arranged: bool


class ChildCreate(BaseModel):
    beneficiary_id: str
    birth_registration_no: str | None = None
    birth_weight_grams: int | None = None
    birth_length_cm: float | None = None
    head_circumference_cm: float | None = None
    gestation_weeks: int | None = None
    delivery_type: str | None = None
    place_of_birth: str | None = None
    apgar_1min: int | None = None
    apgar_5min: int | None = None
    congenital_anomalies: dict[str, Any] | None = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    beneficiary_id: str
    birth_registration_no: str | None = None
    birth_weight_grams: int | None = None
    gestation_weeks: int | None = None
    congenital_anomalies: dict[str, Any] | None = None


class ImmunizationCreate(BaseModel):
    child_id: str
    vaccine_code: str
    vaccine_name: str | None = None
    dose_number: int = 1
    due_date: date | None = None
    given_date: date | None = None
    status: str = "due"
    given_by: str | None = None
    facility_id: str | None = None
    batch_number: str | None = None
    expiry_date: date | None = None
    route: str | None = None
    site: str | None = None
    adverse_event: dict[str, Any] | None = None


class ImmunizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    vaccine_code: str
    vaccine_name: str | None = None
    dose_number: int
    due_date: date | None = None
    given_date: date | None = None
    status: str
    recorded_by: str | None = None
    created_at: datetime


class ImmunizationStatusUpdate(BaseModel):
    status: Literal["due", "given", "overdue", "skipped"]
    given_date: date | None = None
    given_by: str | None = None
    batch_number: str | None = None
    facility_id: str | None = None


class HBNCVisitCreate(BaseModel):
    visit_number: int = 1
    visit_date: date
    weight_grams: int | None = None
    temperature: float | None = None
    breastfeeding_status: str | None = None
    cord_condition: str | None = None
    skin_condition: str | None = None
    danger_signs: dict[str, Any] | None = None
    referral_made: bool = False
    referral_reason: str | None = None


class HBNCVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    visit_number: int
    visit_date: date
    weight_grams: int | None = None
    danger_signs: dict[str, Any] | None = None
    referral_made: bool


class HBYCVisitCreate(BaseModel):
    visit_number: int = 1
    visit_date: date
    age_months: int | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    muac_mm: float | None = None
    z_score_wfa: float | None = None
    z_score_hfa: float | None = None
    z_score_wfh: float | None = None
    nutrition_status: str | None = None
    developmental_milestones: dict[str, Any] | None = None
    danger_signs: dict[str, Any] | None = None
    referral_made: bool = False


class HBYCVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    visit_number: int
    visit_date: date
    age_months: int | None = None
    weight_kg: float | None = None
    muac_mm: float | None = None
    nutrition_status: str | None = None
    referral_made: bool


class GrowthRecordCreate(BaseModel):
    record_date: date
    weight_kg: float | None = None
    height_cm: float | None = None
    muac_mm: float | None = None
    z_score_wfa: float | None = None
    z_score_hfa: float | None = None
    z_score_wfh: float | None = None
    bmi: float | None = None
    nutrition_status: str | None = None
    photo_url: str | None = None


class GrowthRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    record_date: date
    weight_kg: float | None = None
    height_cm: float | None = None
    muac_mm: float | None = None
    z_score_wfa: float | None = None
    nutrition_status: str | None = None
    photo_url: str | None = None
