import { apiRequest } from '@/auth/api';

import type {
  AIPrediction,
  MaternalRiskPayload,
  MyHousehold,
  MyPatientProfile,
  NcdRiskPayload,
  PatientProfileUpdatePayload,
} from './types';

/**
 * Patient-facing API surface: the same endpoints the web patient portal calls
 * (patient.service.ts, ai.service.ts, notification.service.ts), on top of the
 * app's single authed fetch. Everything is request/response — the profile is
 * resolved server-side, which is why the screens can render offline-safe
 * placeholders from usePatientProfile instead of reading local tables.
 */

// --- Wire shapes ------------------------------------------------------------

interface RawMyProfile {
  user_id: string;
  beneficiary_id: string | null;
  full_name: string;
  phone: string;
  abha_id: string | null;
  date_of_birth: string | null;
  age_years: number | null;
  gender: string | null;
  blood_group: string | null;
  village: string | null;
  household_id: string | null;
  address: string | null;
  phc_name: string | null;
  asha_worker_name: string | null;
  is_pregnant: boolean;
  active_conditions: string[];
  profile_inputs?: Record<string, unknown> | null;
  pregnancy: {
    lmp: string | null;
    edd: string | null;
    anc_visits: number;
    risk_level: string;
    high_risk: boolean;
    trimester: number | null;
    week: number | null;
  } | null;
  vitals: {
    height_cm: number | null;
    weight_kg: number | null;
    bmi: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    pulse: number | null;
    temperature: number | null;
    spo2: number | null;
    hemoglobin: number | null;
    blood_sugar_random: number | null;
    waist_circumference_cm: number | null;
    blood_group: string | null;
  } | null;
}

/** Wire shape of `GET /patients/me/household` (`PatientHouseholdResponse`). */
interface RawMyHousehold {
  id: string;
  hhid: string;
  head_name: string | null;
  ward: string | null;
  address: string | null;
  village: string | null;
  family_size: number | null;
  contact_phone: string | null;
  member_count: number;
  members: RawMyHouseholdMember[];
}

interface RawMyHouseholdMember {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  age_months: number | null;
  relationship_to_head: string | null;
  marital_status: string | null;
  is_pregnant: boolean;
  is_lactating: boolean;
  is_self: boolean;
}

interface RawPrediction {
  id: string;
  beneficiary_id: string;
  model_name: string;
  model_version?: string | null;
  prediction?: Record<string, unknown> | null;
  confidence?: number | null;
  explanation?: AIPrediction['explanation'] | null;
  created_at: string;
}

interface RawNotification {
  id: string;
  user_id: string;
  type?: string;
  title: string;
  message: string;
  status?: string;
  created_at?: string;
}

export interface PatientNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function mapMyProfile(data: RawMyProfile): MyPatientProfile {
  return {
    userId: data.user_id,
    beneficiaryId: data.beneficiary_id,
    fullName: data.full_name,
    phone: data.phone,
    abhaId: data.abha_id,
    dateOfBirth: data.date_of_birth,
    ageYears: data.age_years,
    gender: data.gender,
    bloodGroup: data.blood_group,
    village: data.village,
    householdId: data.household_id,
    address: data.address,
    phcName: data.phc_name,
    ashaWorkerName: data.asha_worker_name,
    isPregnant: data.is_pregnant,
    activeConditions: data.active_conditions ?? [],
    profileInputs: data.profile_inputs ?? null,
    pregnancy: data.pregnancy
      ? {
          lmp: data.pregnancy.lmp,
          edd: data.pregnancy.edd,
          ancVisits: data.pregnancy.anc_visits,
          riskLevel: data.pregnancy.risk_level,
          highRisk: data.pregnancy.high_risk,
          trimester: data.pregnancy.trimester,
          week: data.pregnancy.week,
        }
      : null,
    vitals: data.vitals
      ? {
          heightCm: data.vitals.height_cm,
          weightKg: data.vitals.weight_kg,
          bmi: data.vitals.bmi,
          bpSystolic: data.vitals.bp_systolic,
          bpDiastolic: data.vitals.bp_diastolic,
          pulse: data.vitals.pulse,
          temperature: data.vitals.temperature,
          spo2: data.vitals.spo2,
          hemoglobin: data.vitals.hemoglobin,
          bloodSugarRandom: data.vitals.blood_sugar_random,
          waistCircumferenceCm: data.vitals.waist_circumference_cm,
          bloodGroup: data.vitals.blood_group,
        }
      : null,
  };
}

function mapMyHousehold(data: RawMyHousehold): MyHousehold {
  return {
    id: data.id,
    householdId: data.hhid,
    headName: data.head_name,
    ward: data.ward,
    address: data.address,
    village: data.village,
    familySize: data.family_size,
    contactPhone: data.contact_phone,
    memberCount: data.member_count,
    members: (data.members ?? []).map((member) => ({
      id: member.id,
      fullName: member.full_name,
      gender: member.gender,
      ageYears: member.age_years,
      ageMonths: member.age_months,
      relationshipToHead: member.relationship_to_head,
      maritalStatus: member.marital_status,
      isPregnant: member.is_pregnant,
      isLactating: member.is_lactating,
      isSelf: member.is_self,
    })),
  };
}

function mapPrediction(r: RawPrediction): AIPrediction {
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    modelName: r.model_name,
    modelVersion: r.model_version ?? undefined,
    prediction: r.prediction ?? null,
    confidence: r.confidence ?? undefined,
    explanation: r.explanation ?? null,
    createdAt: r.created_at,
  };
}

function dropUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

/** camel payload key → the snake_case column `PatientProfileUpdate` uses. */
const PROFILE_UPDATE_COLUMNS: Array<[keyof PatientProfileUpdatePayload, string]> = [
  ['heightCm', 'height_cm'],
  ['weightKg', 'weight_kg'],
  ['bpSystolic', 'bp_systolic'],
  ['bpDiastolic', 'bp_diastolic'],
  ['bloodSugarRandom', 'blood_sugar_random'],
  ['waistCircumferenceCm', 'waist_circumference_cm'],
  ['hemoglobin', 'hemoglobin'],
  ['tobaccoUse', 'tobacco_use'],
  ['alcoholUse', 'alcohol_use'],
  ['physicalActivity', 'physical_activity'],
  ['familyHistoryDiabetes', 'family_history_diabetes'],
  ['familyHistoryHypertension', 'family_history_hypertension'],
  ['knownDiabetes', 'known_diabetes'],
  ['knownHypertension', 'known_hypertension'],
  ['gravida', 'gravida'],
  ['parity', 'parity'],
  ['previousCsection', 'previous_csection'],
  ['previousMiscarriages', 'previous_miscarriages'],
  ['previousPph', 'previous_pph'],
  ['previousPreterm', 'previous_preterm'],
  ['previousStillbirth', 'previous_stillbirth'],
  ['multiplePregnancy', 'multiple_pregnancy'],
];

// --- Profile ----------------------------------------------------------------

/**
 * 60-second in-memory cache, the mobile stand-in for the web query's
 * `staleTime: 60_000`: five screens share one request without react-query,
 * and a save invalidates it so the next mount shows the new values.
 */
const PROFILE_TTL_MS = 60_000;
let profileCache: { at: number; raw: MyPatientProfile } | null = null;

export async function getMyProfile(options: { force?: boolean } = {}): Promise<MyPatientProfile> {
  if (!options.force && profileCache && Date.now() - profileCache.at < PROFILE_TTL_MS) {
    return profileCache.raw;
  }
  const data = await apiRequest<RawMyProfile>('/patients/me');
  const mapped = mapMyProfile(data);
  profileCache = { at: Date.now(), raw: mapped };
  return mapped;
}

export function invalidateProfileCache(): void {
  profileCache = null;
}

/**
 * `GET /patients/me/household` — the family view: the patient's household and
 * everyone registered in it. 404s when no household is linked, which the
 * screen renders as "not linked yet" rather than as a failure.
 */
export async function getMyHousehold(): Promise<MyHousehold> {
  const data = await apiRequest<RawMyHousehold>('/patients/me/household');
  return mapMyHousehold(data);
}

/**
 * `PUT /patients/me` — merges only the keys given, so an empty numeric field
 * in the edit form means "leave unchanged", never "clear".
 */
export async function updateMyProfile(
  payload: PatientProfileUpdatePayload,
): Promise<MyPatientProfile> {
  const body: Record<string, unknown> = {};
  for (const [key, column] of PROFILE_UPDATE_COLUMNS) {
    const value = payload[key];
    if (value !== undefined) body[column] = value;
  }
  const data = await apiRequest<RawMyProfile>('/patients/me', { method: 'PUT', body });
  const mapped = mapMyProfile(data);
  profileCache = { at: Date.now(), raw: mapped };
  return mapped;
}

// --- Appointments -----------------------------------------------------------

export interface AppointmentRequestPayload {
  reason: string;
  preferredDate: string; // YYYY-MM-DD
  preferredTime?: string;
  notes?: string;
}

export interface AppointmentRequest {
  id: string;
  reason: string;
  preferred_date: string;
  preferred_time: string | null;
  notes: string | null;
  status: string;
  asha_worker_name: string | null;
  created_at: string | null;
}

/** `POST /patients/me/appointment-requests` — creates an ASHA task + notification. */
export async function createAppointmentRequest(
  payload: AppointmentRequestPayload,
): Promise<AppointmentRequest> {
  return apiRequest<AppointmentRequest>('/patients/me/appointment-requests', {
    method: 'POST',
    body: {
      reason: payload.reason,
      preferred_date: payload.preferredDate,
      preferred_time: payload.preferredTime,
      notes: payload.notes,
    },
  });
}

/** `GET /patients/me/appointment-requests` — lists the patient's requests. */
export async function listAppointmentRequests(): Promise<AppointmentRequest[]> {
  return apiRequest<AppointmentRequest[]>('/patients/me/appointment-requests');
}

// --- ML ---------------------------------------------------------------------

/** `GET /ai/predictions` — stored predictions for one beneficiary, newest first. */
export async function listPredictions(
  beneficiaryId: string,
  limit = 50,
): Promise<AIPrediction[]> {
  const data = await apiRequest<RawPrediction[]>(
    `/ai/predictions?beneficiary_id=${encodeURIComponent(beneficiaryId)}&limit=${limit}`,
  );
  return data.map(mapPrediction);
}

export async function predictNcdRisk(payload: NcdRiskPayload): Promise<AIPrediction> {
  const data = await apiRequest<RawPrediction>('/ai/ncd-risk/predict', {
    method: 'POST',
    body: dropUndefined({
      beneficiary_id: payload.beneficiaryId,
      age: payload.age,
      sex: payload.sex,
      height_cm: payload.heightCm,
      weight_kg: payload.weightKg,
      bmi: payload.bmi,
      tobacco_use: payload.tobaccoUse,
      alcohol_use: payload.alcoholUse,
      waist_circumference_cm: payload.waistCircumferenceCm,
      physical_activity: payload.physicalActivity,
      family_history_diabetes: payload.familyHistoryDiabetes,
      family_history_hypertension: payload.familyHistoryHypertension,
      known_diabetes: payload.knownDiabetes,
      known_hypertension: payload.knownHypertension,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      blood_sugar_random: payload.bloodSugarRandom,
    }),
  });
  return mapPrediction(data);
}

export async function predictMaternalRisk(payload: MaternalRiskPayload): Promise<AIPrediction> {
  const data = await apiRequest<RawPrediction>('/ai/maternal-risk/predict', {
    method: 'POST',
    body: dropUndefined({
      beneficiary_id: payload.beneficiaryId,
      age: payload.age,
      gravida: payload.gravida,
      parity: payload.parity,
      gestational_weeks: payload.gestationalWeeks,
      hemoglobin: payload.hemoglobin,
      blood_sugar: payload.bloodSugar,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      weight_kg: payload.weightKg,
      height_cm: payload.heightCm,
      previous_csection: payload.previousCsection,
      previous_pph: payload.previousPph,
      previous_preterm: payload.previousPreterm,
      previous_stillbirth: payload.previousStillbirth,
      multiple_pregnancy: payload.multiplePregnancy,
      anc_visits_attended: payload.ancVisitsAttended,
      has_risk_factors: payload.hasRiskFactors,
    }),
  });
  return mapPrediction(data);
}

// --- Account ----------------------------------------------------------------

/**
 * `PUT /auth/me` — persists the chosen UI language to the account, the same
 * call the web's settings page makes, so a language picked on one device
 * follows the patient to the next login.
 */
export async function updateMyLanguage(language: 'en' | 'hi'): Promise<void> {
  await apiRequest('/auth/me', { method: 'PUT', body: { language } });
}

// --- Notifications ----------------------------------------------------------

/** `GET /notifications` — the signed-in user's feed, newest first. */
export async function listNotifications(pageSize = 50): Promise<PatientNotification[]> {
  const data = await apiRequest<{ items: RawNotification[] }>(
    `/notifications?page=1&page_size=${pageSize}`,
  );
  return (data.items ?? []).map((r) => ({
    id: r.id,
    type: r.type || 'alert',
    title: r.title,
    message: r.message,
    read: (r.status ?? 'unread') === 'read',
    createdAt: r.created_at ?? '',
  }));
}

/** `PUT /notifications/{id}/read`. */
export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
}
