/**
 * Local column registry for every table the app syncs.
 *
 * The column lists are the intersection of what the backend serialises and what
 * the local SQLite table declares, in declaration order. `upsertRows` builds its
 * INSERT from these lists, so adding a server column is a one-line change here
 * instead of a hand-written statement per table.
 *
 * Every foreign key on the server points at the parent's UUID primary key
 * (verified against the live database), so local joins are plain equality:
 * children.beneficiary_id = beneficiaries.id.
 */

export const TABLES = {
  households: [
    'id', 'hhid', 'village_id', 'asha_id', 'address', 'consent_given', 'version', 'updated_at',
    'head_name',
  ],
  beneficiaries: [
    'id', 'beneficiary_id', 'household_id', 'abha_id', 'full_name', 'gender', 'date_of_birth',
    'age_years', 'age_months', 'phone', 'blood_group', 'metadata_json', 'photo_url',
    'relationship_to_head', 'status', 'version', 'updated_at',
  ],
  pregnancies: [
    'id', 'beneficiary_id', 'lmp', 'edd', 'gravida', 'parity', 'abortions', 'living_children',
    'risk_level', 'risk_factors', 'risk_score', 'last_anc_date', 'next_anc_due', 'anc_count',
    'status', 'delivery_outcome_id', 'created_at', 'updated_at', 'version',
  ],
  delivery_outcomes: [
    'id', 'pregnancy_id', 'delivery_date', 'place_of_delivery', 'delivery_type', 'outcome',
    'birth_weight_grams', 'complications', 'birth_notification_no', 'created_at', 'updated_at',
    'version',
  ],
  pnc_visits: [
    'id', 'pregnancy_id', 'visit_number', 'visit_date', 'bp_systolic', 'bp_diastolic',
    'danger_signs_mother', 'breastfeeding_status', 'referral_made', 'created_at', 'updated_at',
    'version',
  ],
  children: [
    'id', 'beneficiary_id', 'mother_id', 'father_id', 'delivery_outcome_id',
    'birth_registration_no', 'birth_weight_grams', 'birth_length_cm',
    'head_circumference_cm', 'gestation_weeks', 'delivery_type', 'place_of_birth', 'apgar_1min',
    'apgar_5min', 'congenital_anomalies', 'created_at', 'updated_at', 'version',
  ],
  immunizations: [
    'id', 'child_id', 'vaccine_code', 'vaccine_name', 'dose_number', 'due_date', 'given_date',
    'status', 'given_by', 'facility_id', 'batch_number', 'expiry_date', 'route', 'site',
    'adverse_event', 'recorded_by', 'created_at', 'updated_at', 'version',
  ],
  hbnc_visits: [
    'id', 'child_id', 'visit_number', 'visit_date', 'weight_grams', 'danger_signs',
    'referral_made', 'created_at', 'updated_at', 'version',
  ],
  hbyc_visits: [
    'id', 'child_id', 'visit_number', 'visit_date', 'age_months', 'weight_kg', 'muac_mm',
    'nutrition_status', 'referral_made', 'created_at', 'updated_at', 'version',
  ],
  asha_tasks: [
    'id', 'asha_id', 'task_date', 'task_type', 'beneficiary_id', 'household_id', 'village_id',
    'priority', 'status', 'scheduled_time', 'completed_time', 'gps_latitude', 'gps_longitude',
    'gps_accuracy', 'notes', 'metadata', 'created_at', 'updated_at', 'version',
  ],
  referrals: [
    'id', 'beneficiary_id', 'referred_from_id', 'referred_from_facility_id',
    'referred_to_facility_id', 'referred_to_specialist_id', 'referral_type', 'urgency', 'reason',
    'clinical_summary', 'investigations', 'provisional_diagnosis', 'status', 'initiated_at',
    'accepted_at', 'completed_at', 'outcome', 'feedback_from_receiver', 'followup_required',
    'followup_date', 'created_at', 'updated_at', 'version',
  ],
  referral_followups: [
    'id', 'referral_id', 'followup_date', 'conducted_by', 'beneficiary_status',
    'treatment_compliance', 'complications', 'further_referral', 'notes',
    'created_at', 'updated_at', 'version',
  ],
  ncd_screenings: [
    'id', 'beneficiary_id', 'screening_date', 'age_above_30', 'tobacco_use', 'alcohol_use',
    'physical_activity', 'waist_circumference_cm', 'family_history_diabetes',
    'family_history_hypertension', 'family_history_cancer', 'known_diabetes', 'known_hypertension',
    'known_cancer', 'bp_systolic', 'bp_diastolic', 'blood_sugar_random', 'cbac_score',
    'diabetes_risk', 'hypertension_risk', 'cardiovascular_risk', 'cancer_risk', 'referral_made',
    'referral_type', 'referral_facility_id', 'recorded_by', 'created_at', 'updated_at', 'version',
  ],
  anc_visits: [
    'id', 'pregnancy_id', 'visit_number', 'visit_date', 'bp_systolic', 'bp_diastolic', 'weight_kg',
    'height_cm', 'bmi', 'temperature', 'pulse', 'respiratory_rate', 'spo2', 'hemoglobin',
    'blood_group', 'rh_factor', 'blood_sugar_random', 'blood_sugar_fasting', 'hba1c', 'urine_protein',
    'urine_sugar', 'hiv_status', 'syphilis_status', 'hbsag_status', 'fundal_height_cm',
    'fetal_heart_rate', 'fetal_movement', 'lie_presentation', 'danger_signs', 'clinical_findings',
    'advice_given', 'referral_made', 'referral_reason', 'referred_facility_id', 'pmsma_attended',
    'recorded_by', 'created_at', 'updated_at', 'version',
  ],
  growth_records: [
    'id', 'child_id', 'record_date', 'weight_kg', 'height_cm', 'muac_mm', 'z_score_wfa',
    'z_score_hfa', 'z_score_wfh', 'bmi', 'nutrition_status', 'photo_url', 'recorded_by',
    'created_at', 'updated_at', 'version',
  ],
  eligible_couples: [
    'id', 'husband_id', 'wife_id', 'registration_date', 'status', 'current_method',
    'method_start_date', 'last_followup_date', 'next_followup_date', 'missed_period_tracked',
    'last_missed_period_date', 'pregnancy_confirmed', 'registered_by', 'created_at', 'updated_at',
    'version',
  ],
  ec_followups: [
    'id', 'ec_id', 'followup_date', 'method_used', 'method_changed', 'side_effects',
    'created_at', 'updated_at', 'version',
  ],
  disease_cases: [
    'id', 'disease_type', 'beneficiary_id', 'village_id', 'detection_date', 'diagnosis_date',
    'lab_confirmed', 'treatment_started', 'treatment_outcome', 'status', 'created_at',
    'updated_at', 'version',
  ],
  village_forms: [
    'id', 'asha_id', 'form_type', 'form_date', 'village_id', 'form_data', 'status', 'submitted_at',
    'verified_by', 'verified_at', 'incentive_eligible', 'incentive_amount', 'created_at',
    'updated_at', 'version',
  ],
  // Per-member ok/concern recorded during a household visit. survey_id is
  // null for a visit queued offline (it links back to the village_form row).
  household_visit_checks: [
    'id', 'household_id', 'survey_id', 'beneficiary_id', 'check_type', 'result', 'notes',
    'visited_at', 'created_by', 'created_at', 'updated_at', 'version',
  ],
  notifications: [
    'id', 'user_id', 'type', 'priority', 'title', 'message', 'action_url',
    'reference_id', 'reference_type', 'status', 'read_at', 'metadata',
    'created_at', 'updated_at', 'version',
  ],
} as const;

export type TableName = keyof typeof TABLES;

/** All synced tables, in the order the sync engine requests them. */
export const ALL_TABLES = Object.keys(TABLES) as TableName[];

/** Narrows an untrusted string (e.g. an outbox `entity`) to a known table. */
export function isTableName(value: string): value is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, value);
}

/** Tables the backend can scope to one ASHA, in the same order as ALL_TABLES. */