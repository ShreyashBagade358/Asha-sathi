import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

export type PatientGender = 'male' | 'female' | 'other'

export interface RegisterPatientPayload {
  fullName: string
  phone: string
  /** `YYYY-MM-DD`, as produced by an `<input type="date">`. */
  dateOfBirth: string
  gender: PatientGender
  abhaId: string
  village?: string
  householdId?: string
  /** e.g. `O+`. Optional — most registrations don't know it yet. */
  bloodGroup?: string
  /** Assigned ASHA worker's name, as chosen on the registration form. */
  ashaWorker?: string
  risk?: string
  notes?: string
}

export interface MyPregnancySummary {
  lmp: string | null
  edd: string | null
  ancVisits: number
  riskLevel: string
  highRisk: boolean
  trimester: number | null
  week: number | null
}

export interface MyPatientVitals {
  heightCm: number | null
  weightKg: number | null
  bpSystolic: number | null
  bpDiastolic: number | null
  hemoglobin: number | null
}

/**
 * `GET /patients/me`. The only server-resolved view of the signed-in patient:
 * joins User → Beneficiary on phone, then Beneficiary.registered_by → ASHA → PHC.
 * Every nullable field means "not recorded", never "unknown default".
 */
export interface MyPatientProfile {
  userId: string
  beneficiaryId: string | null
  fullName: string
  phone: string
  abhaId: string | null
  dateOfBirth: string | null
  ageYears: number | null
  gender: string | null
  bloodGroup: string | null
  village: string | null
  householdId: string | null
  address: string | null
  phcName: string | null
  ashaWorkerName: string | null
  isPregnant: boolean
  activeConditions: string[]
  pregnancy: MyPregnancySummary | null
  vitals: MyPatientVitals | null
  /**
   * Raw slice written by `PUT /patients/me` (`Beneficiary.metadata_json[
   * "profile_inputs"]`). Screening inputs the profile form edits and the ML
   * risk endpoints read back live here — the server derives `vitals` from it.
   */
  profileInputs?: Record<string, unknown> | null
}

/** Fields the patient may edit about their own screening inputs. */
export interface PatientProfileUpdatePayload {
  heightCm?: number
  weightKg?: number
  bpSystolic?: number
  bpDiastolic?: number
  bloodSugarRandom?: number
  waistCircumferenceCm?: number
  hemoglobin?: number
  tobaccoUse?: boolean
  alcoholUse?: boolean
  physicalActivity?: 'low' | 'moderate' | 'high'
  familyHistoryDiabetes?: boolean
  familyHistoryHypertension?: boolean
  knownDiabetes?: boolean
  knownHypertension?: boolean
  gravida?: number
  parity?: number
  previousCsection?: boolean
  previousMiscarriages?: boolean
  previousPph?: boolean
  previousPreterm?: boolean
  previousStillbirth?: boolean
  multiplePregnancy?: boolean
}

/** Returned once, at registration — the password is stored only as a hash. */
export interface RegisteredPatient {
  userId: string
  beneficiaryId: string
  phone: string
  fullName: string
  password: string
}

/**
 * Pull a human-readable message out of the several shapes an API failure can
 * take: our `{detail: "..."}` envelope, FastAPI's 422 `{detail: [{loc, msg}]}`
 * list, or a plain axios network error.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail: unknown = err.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const parts = detail
        .map((d: unknown) => {
          if (!d || typeof d !== 'object') return ''
          const rec = d as { loc?: unknown; msg?: unknown }
          const field = Array.isArray(rec.loc) ? String(rec.loc[rec.loc.length - 1]) : ''
          const msg = typeof rec.msg === 'string' ? rec.msg : ''
          if (!msg) return ''
          return field ? `${field}: ${msg}` : msg
        })
        .filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
    }
    if (err.response) return fallback
    return err.message || fallback
  }
  return err instanceof Error && err.message ? err.message : fallback
}

/** Wire shape of `GET|PUT /patients/me` (`PatientProfileResponse`). */
interface RawMyProfile {
  user_id: string
  beneficiary_id: string | null
  full_name: string
  phone: string
  abha_id: string | null
  date_of_birth: string | null
  age_years: number | null
  gender: string | null
  blood_group: string | null
  village: string | null
  household_id: string | null
  address: string | null
  phc_name: string | null
  asha_worker_name: string | null
  is_pregnant: boolean
  active_conditions: string[]
  profile_inputs?: Record<string, unknown> | null
  pregnancy: {
    lmp: string | null
    edd: string | null
    anc_visits: number
    risk_level: string
    high_risk: boolean
    trimester: number | null
    week: number | null
  } | null
  vitals: {
    height_cm: number | null
    weight_kg: number | null
    bp_systolic: number | null
    bp_diastolic: number | null
    hemoglobin: number | null
  } | null
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
]

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
          bpSystolic: data.vitals.bp_systolic,
          bpDiastolic: data.vitals.bp_diastolic,
          hemoglobin: data.vitals.hemoglobin,
        }
      : null,
  }
}

export const patientService = {
  async register(payload: RegisterPatientPayload): Promise<RegisteredPatient> {
    const { data } = await api.post<{
      user_id: string
      beneficiary_id: string
      phone: string
      full_name: string
      password: string
    }>('/patients/register', {
      full_name: payload.fullName,
      phone: payload.phone,
      date_of_birth: payload.dateOfBirth,
      gender: payload.gender,
      abha_id: payload.abhaId,
      village: payload.village || undefined,
      household_id: payload.householdId || undefined,
      blood_group: payload.bloodGroup || undefined,
      asha_worker: payload.ashaWorker || undefined,
      risk: payload.risk || undefined,
      notes: payload.notes || undefined,
    })
    return {
      userId: data.user_id,
      beneficiaryId: data.beneficiary_id,
      phone: data.phone,
      fullName: data.full_name,
      password: data.password,
    }
  },

  async getMyProfile(): Promise<MyPatientProfile> {
    const { data } = await api.get<RawMyProfile>('/patients/me')
    return mapMyProfile(data)
  },

  /**
   * `PUT /patients/me` — merges the patient's own screening inputs into
   * `Beneficiary.metadata_json["profile_inputs"]`. Only the keys present in
   * the payload are written; the response is the same document `GET /me`
   * returns, so callers can swap it straight into their cache.
   */
  async updateMyProfile(payload: PatientProfileUpdatePayload): Promise<MyPatientProfile> {
    const body: Record<string, unknown> = {}
    for (const [key, column] of PROFILE_UPDATE_COLUMNS) {
      const value = payload[key]
      if (value !== undefined) body[column] = value
    }
    const { data } = await api.put<RawMyProfile>('/patients/me', body)
    return mapMyProfile(data)
  },
}
