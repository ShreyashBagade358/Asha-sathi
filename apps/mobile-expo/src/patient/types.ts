/**
 * Patient-dashboard wire and view types.
 *
 * The dashboard shapes (Appointment, HealthRecord, VaccineDose, referral
 * statuses, …) are a direct port of apps/web-dashboard/src/pages/patient/
 * mockData.ts, and the profile / ML shapes mirror
 * apps/web-dashboard/src/services/patient.service.ts and ai.service.ts, so the
 * mobile screens stay a line-for-line copy of their web counterparts.
 */

// --- Profile (`GET|PUT /patients/me`) --------------------------------------

export interface MyPregnancySummary {
  lmp: string | null;
  edd: string | null;
  ancVisits: number;
  riskLevel: string;
  highRisk: boolean;
  trimester: number | null;
  week: number | null;
}

export interface MyPatientVitals {
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  hemoglobin: number | null;
  bloodSugarRandom: number | null;
  waistCircumferenceCm: number | null;
  bloodGroup: string | null;
}

/**
 * `GET /patients/me`. The only server-resolved view of the signed-in patient:
 * joins User → Beneficiary on phone, then Beneficiary.registered_by → ASHA →
 * PHC. Every nullable field means "not recorded", never "unknown default".
 */
export interface MyPatientProfile {
  userId: string;
  beneficiaryId: string | null;
  fullName: string;
  phone: string;
  abhaId: string | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  gender: string | null;
  bloodGroup: string | null;
  village: string | null;
  householdId: string | null;
  address: string | null;
  phcName: string | null;
  ashaWorkerName: string | null;
  isPregnant: boolean;
  activeConditions: string[];
  pregnancy: MyPregnancySummary | null;
  vitals: MyPatientVitals | null;
  /** Raw `Beneficiary.metadata_json["profile_inputs"]` — what the edit form and ML read. */
  profileInputs?: Record<string, unknown> | null;
}

/** Fields the patient may edit about their own screening inputs. */
export interface PatientProfileUpdatePayload {
  heightCm?: number;
  weightKg?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodSugarRandom?: number;
  waistCircumferenceCm?: number;
  hemoglobin?: number;
  tobaccoUse?: boolean;
  alcoholUse?: boolean;
  physicalActivity?: 'low' | 'moderate' | 'high';
  familyHistoryDiabetes?: boolean;
  familyHistoryHypertension?: boolean;
  knownDiabetes?: boolean;
  knownHypertension?: boolean;
  gravida?: number;
  parity?: number;
  previousCsection?: boolean;
  previousMiscarriages?: boolean;
  previousPph?: boolean;
  previousPreterm?: boolean;
  previousStillbirth?: boolean;
  multiplePregnancy?: boolean;
}

/**
 * Display projection of `MyPatientProfile`, ported from the web's
 * `PatientProfile` in pages/patient/mockData.ts. Formatting happens in exactly
 * one place (src/patient/profile.ts) so every screen agrees on "—".
 */
export interface PatientProfile {
  id: string;
  name: string;
  abhaId: string;
  age: number;
  gender: string;
  dob: string;
  bloodGroup: string;
  phone: string;
  address: string;
  village: string;
  phc: string;
  ashaWorker: string;
  height: string;
  weight: string;
  bmi: string;
  latestBp: string;
  pulse: string;
  temperature: string;
  spo2: string;
  haemoglobin: string;
  bloodSugar: string;
  waistCircumference: string;
  activeConditions: string[];
  pregnant: boolean;
  trimester: number;
  week: number;
  lmp: string;
  edd: string;
  ancVisits: number;
  highRisk: boolean;
}

// --- Family ----------------------------------------------------------------

/**
 * One family member as the signed-in patient may see them, from
 * `GET /patients/me/household`: a name, an age and a relation. No phone, no
 * ABHA id, no clinical history — the family view says who lives here.
 */
export interface MyHouseholdMember {
  id: string;
  fullName: string;
  gender: string | null;
  ageYears: number | null;
  ageMonths: number | null;
  relationshipToHead: string | null;
  maritalStatus: string | null;
  isPregnant: boolean;
  isLactating: boolean;
  /** True for the signed-in patient, so the UI can label "You". */
  isSelf: boolean;
}

/** The patient's own household: demographics plus the family roll. */
export interface MyHousehold {
  id: string;
  householdId: string;
  headName: string | null;
  ward: string | null;
  address: string | null;
  village: string | null;
  familySize: number | null;
  contactPhone: string | null;
  memberCount: number;
  members: MyHouseholdMember[];
}

// --- Dashboard lists --------------------------------------------------------

export type AppointmentStatus = 'upcoming' | 'past';

export interface Appointment {
  id: string;
  type: string;
  location: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  doctor?: string;
}

export type HealthRecordCategory = 'checkup' | 'prescription' | 'lab';

export interface HealthRecord {
  id: string;
  category: HealthRecordCategory;
  title: string;
  date: string;
  facility: string;
  details: { label: string; value: string }[];
  doctor?: string;
  dose?: string;
  duration?: string;
  downloadable?: boolean;
}

export type DoseStatus = 'given' | 'due' | 'overdue' | 'upcoming';

export interface VaccineDose {
  id: string;
  name: string;
  vaccines: string;
  date: string;
  status: DoseStatus;
}

export type PatientReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';
export type PatientReferralUrgency = 'routine' | 'urgent' | 'emergency';

/** A referral row reshaped for the patient's referrals screen. */
export interface PatientReferral {
  id: string;
  toFacility: string;
  date: string;
  referredBy: string;
  reason: string;
  status: PatientReferralStatus;
  urgency: PatientReferralUrgency;
}

export type PatientNotifType = 'appointment' | 'referral' | 'health' | 'system';

// --- ML predictions (`/ai/*`) ----------------------------------------------

export interface AIPredictionExplanation {
  method?: string;
  risk_factors?: string[];
  probabilities?: Record<string, number>;
}

export interface AIPrediction {
  id: string;
  beneficiaryId: string;
  modelName: string;
  modelVersion?: string;
  prediction: Record<string, unknown> | null;
  confidence?: number;
  explanation: AIPredictionExplanation | null;
  createdAt: string;
}

/** `POST /ai/ncd-risk/predict` request, camel-cased like the web client. */
export interface NcdRiskPayload {
  beneficiaryId: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  tobaccoUse?: boolean;
  alcoholUse?: boolean;
  waistCircumferenceCm?: number;
  physicalActivity?: 'low' | 'moderate' | 'high';
  familyHistoryDiabetes?: boolean;
  familyHistoryHypertension?: boolean;
  knownDiabetes?: boolean;
  knownHypertension?: boolean;
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodSugarRandom?: number;
}

/** `POST /ai/maternal-risk/predict` request, camel-cased like the web client. */
export interface MaternalRiskPayload {
  beneficiaryId: string;
  age?: number;
  gravida?: number;
  parity?: number;
  gestationalWeeks?: number;
  hemoglobin?: number;
  bloodSugar?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  weightKg?: number;
  heightCm?: number;
  previousCsection?: boolean;
  previousPph?: boolean;
  previousPreterm?: boolean;
  previousStillbirth?: boolean;
  multiplePregnancy?: boolean;
  ancVisitsAttended?: number;
  hasRiskFactors?: boolean;
}
