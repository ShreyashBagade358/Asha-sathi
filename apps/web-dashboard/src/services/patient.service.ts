import { isAxiosError } from 'axios';
import { api } from '@/lib/api';

export type PatientGender = 'male' | 'female' | 'other';

export interface RegisterPatientPayload {
  fullName: string;
  phone: string;
  /** `YYYY-MM-DD`, as produced by an `<input type="date">`. */
  dateOfBirth: string;
  gender: PatientGender;
  abhaId: string;
  village?: string;
  /** Intake geography (names), stored on the beneficiary's metadata. */
  state?: string;
  district?: string;
  householdId?: string;
  /** How this patient relates to the household head (family linking). */
  relationshipToHead?: string;
  /** e.g. `O+`. Optional — most registrations don't know it yet. */
  bloodGroup?: string;
  /** Assigned ASHA worker's name, as chosen on the registration form. */
  ashaWorker?: string;
  risk?: string;
  notes?: string;
}

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
 * joins User → Beneficiary on phone, then Beneficiary.registered_by → ASHA → PHC.
 * Every nullable field means "not recorded", never "unknown default".
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
  /**
   * Raw slice written by `PUT /patients/me` (`Beneficiary.metadata_json[
   * "profile_inputs"]`). Screening inputs the profile form edits and the ML
   * risk endpoints read back live here — the server derives `vitals` from it.
   */
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

/** Returned once, at registration — the password is stored only as a hash. */
export interface RegisteredPatient {
  userId: string;
  beneficiaryId: string;
  phone: string;
  fullName: string;
  password: string;
}

/**
 * Pull a human-readable message out of the several shapes an API failure can
 * take: our `{detail: "..."}` envelope, FastAPI's 422 `{detail: [{loc, msg}]}`
 * list, or a plain axios network error.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail: unknown = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const parts = detail
        .map((d: unknown) => {
          if (!d || typeof d !== 'object') return '';
          const rec = d as { loc?: unknown; msg?: unknown };
          const field = Array.isArray(rec.loc) ? String(rec.loc[rec.loc.length - 1]) : '';
          const msg = typeof rec.msg === 'string' ? rec.msg : '';
          if (!msg) return '';
          return field ? `${field}: ${msg}` : msg;
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (err.response) return fallback;
    return err.message || fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Wire shape of `GET|PUT /patients/me` (`PatientProfileResponse`). */
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

/** Camel-case payload key → the snake_case column `PatientProfileUpdate` uses. */
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

/**
 * `GET /patients/me/household`. One family member as the patient may see them:
 * a name, an age and a relation. No phone, no ABHA id, no clinical history.
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
  /** True for the signed-in patient's own row, so the UI can label "You". */
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
  members: Array<{
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
  }>;
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

export const patientService = {
  async register(payload: RegisterPatientPayload): Promise<RegisteredPatient> {
    const { data } = await api.post<{
      user_id: string;
      beneficiary_id: string;
      phone: string;
      full_name: string;
      password: string;
    }>('/patients/register', {
      full_name: payload.fullName,
      phone: payload.phone,
      date_of_birth: payload.dateOfBirth,
      gender: payload.gender,
      abha_id: payload.abhaId,
      village: payload.village || undefined,
      state: payload.state || undefined,
      district: payload.district || undefined,
      household_id: payload.householdId || undefined,
      relationship_to_head: payload.relationshipToHead || undefined,
      blood_group: payload.bloodGroup || undefined,
      asha_worker: payload.ashaWorker || undefined,
      risk: payload.risk || undefined,
      notes: payload.notes || undefined,
    });
    return {
      userId: data.user_id,
      beneficiaryId: data.beneficiary_id,
      phone: data.phone,
      fullName: data.full_name,
      password: data.password,
    };
  },

  async getMyProfile(): Promise<MyPatientProfile> {
    const { data } = await api.get<RawMyProfile>('/patients/me');
    return mapMyProfile(data);
  },

  /**
   * `GET /patients/me/household` — the family view. 404s when the profile has
   * no linked household, which callers render as "no family linked" rather
   * than as an error state.
   */
  async getMyHousehold(): Promise<MyHousehold> {
    const { data } = await api.get<RawMyHousehold>('/patients/me/household');
    return mapMyHousehold(data);
  },

  /**
   * `PUT /patients/me` — merges the patient's own screening inputs into
   * `Beneficiary.metadata_json["profile_inputs"]`. Only the keys present in
   * the payload are written; the response is the same document `GET /me`
   * returns, so callers can swap it straight into their cache.
   */
  async updateMyProfile(payload: PatientProfileUpdatePayload): Promise<MyPatientProfile> {
    const body: Record<string, unknown> = {};
    for (const [key, column] of PROFILE_UPDATE_COLUMNS) {
      const value = payload[key];
      if (value !== undefined) body[column] = value;
    }
    const { data } = await api.put<RawMyProfile>('/patients/me', body);
    return mapMyProfile(data);
  },

  /**
   * `POST /patients/me/appointment-requests` — books an appointment with the
   * patient's ASHA worker (creates an ASHATask + notification server-side).
   */
  async createAppointmentRequest(payload: {
    reason: string;
    preferredDate: string;
    preferredTime?: string;
    notes?: string;
  }): Promise<AppointmentRequest> {
    const { data } = await api.post<AppointmentRequest>('/patients/me/appointment-requests', {
      reason: payload.reason,
      preferred_date: payload.preferredDate,
      preferred_time: payload.preferredTime || undefined,
      notes: payload.notes || undefined,
    });
    return data;
  },

  /** `GET /patients/me/appointment-requests` — lists the patient's bookings. */
  async listAppointmentRequests(): Promise<AppointmentRequest[]> {
    const { data } = await api.get<AppointmentRequest[]>('/patients/me/appointment-requests');
    return data;
  },

  /**
   * `POST /patients/me/referral-requests` — patient requests a referral to a
   * higher facility (creates a Referral row + ASHA notification server-side).
   */
  async createReferralRequest(payload: {
    referralType: string;
    urgency: 'routine' | 'urgent' | 'emergency';
    reason: string;
  }): Promise<ReferralRequest> {
    const { data } = await api.post<ReferralRequest>('/patients/me/referral-requests', {
      referral_type: payload.referralType,
      urgency: payload.urgency,
      reason: payload.reason,
    });
    return data;
  },

  /** `GET /patients/me/referral-requests` — lists the patient's referrals. */
  async listReferralRequests(): Promise<ReferralRequest[]> {
    const { data } = await api.get<ReferralRequest[]>('/patients/me/referral-requests');
    return data;
  },

  /** `GET /patients/me/follow-ups` — referral follow-ups + open ASHA tasks. */
  async listFollowUps(): Promise<PatientFollowUp[]> {
    const { data } = await api.get<{ referral_followups: PatientFollowUp[]; tasks: PatientFollowUp[] }>(
      '/patients/me/follow-ups'
    );
    return [...(data.referral_followups ?? []), ...(data.tasks ?? [])];
  },

  /**
   * `GET /patients/me/children` — the patient's own children, scoped by
   * parentage (mother_id / father_id) server-side. A woman sees only the
   * children she bore; a man only the children he fathered. Replaces the
   * unscoped ASHA-facing `GET /children` list the vaccination page used to
   * call (which handed every patient every child in the deployment).
   */
  async getMyChildren(): Promise<MyChild[]> {
    const { data } = await api.get<MyChild[]>('/patients/me/children');
    return data;
  },

  /**
   * `POST /patients/me/pregnancy` — patient reports her own pregnancy.
   * Server resolves the beneficiary from the signed-in account, validates
   * female gender, derives EDD from LMP, and notifies the ASHA worker.
   */
  async createMyPregnancy(payload: {
    lmp: string; // YYYY-MM-DD
    gravida?: number;
    parity?: number;
    notes?: string;
  }): Promise<PregnancyReport> {
    const { data } = await api.post<PregnancyReport>('/patients/me/pregnancy', {
      lmp: payload.lmp,
      gravida: payload.gravida,
      parity: payload.parity,
      notes: payload.notes,
    });
    return data;
  },
};

// --- Appointments ------------------------------------------------------------

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

// --- Referrals ---------------------------------------------------------------

export interface ReferralRequest {
  id: string;
  referral_type: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  reason: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  asha_worker_name: string | null;
  created_at: string | null;
}

// --- Follow-ups --------------------------------------------------------------

export interface PatientFollowUp {
  id: string;
  type: 'referral' | 'task';
  title: string;
  due_date: string | null;
  detail: string;
  status: string;
}

// --- Children ----------------------------------------------------------------

/** Wire shape of `GET /patients/me/children` (snake_case from the API). */
export interface MyChild {
  id: string;
  beneficiary_id: string;
  mother_id: string | null;
  father_id: string | null;
  mother_name: string | null;
  father_name: string | null;
  birth_registration_no: string | null;
  birth_weight_grams: number | null;
  gestation_weeks: number | null;
}

// --- Pregnancy ---------------------------------------------------------------

/** Wire shape of `POST /patients/me/pregnancy`. */
export interface PregnancyReport {
  id: string;
  lmp: string;
  edd: string;
  gravida: number | null;
  parity: number | null;
  status: string;
  asha_worker_name: string | null;
  created_at: string | null;
}
