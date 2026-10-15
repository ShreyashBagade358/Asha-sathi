import { api } from '@/lib/api'

export interface CreateScreeningPayload {
  beneficiaryId: string
  screeningDate: string
  ageAbove30?: boolean
  tobaccoUse?: boolean
  alcoholUse?: boolean
  physicalActivity?: boolean
  waistCircumferenceCm?: number
  familyHistoryDiabetes?: boolean
  familyHistoryHypertension?: boolean
  familyHistoryCancer?: boolean
  knownDiabetes?: boolean
  knownHypertension?: boolean
  knownCancer?: boolean
  bpSystolic?: number
  bpDiastolic?: number
  bloodSugarRandom?: number
  cbacScore?: number
  diabetesRisk?: string
  hypertensionRisk?: string
  cardiovascularRisk?: string
  cancerRisk?: string
  referralMade?: boolean
  referralType?: string
  referralFacilityId?: string
}

export interface NCDScreening {
  id: string
  beneficiaryId: string
  screeningDate: string
  bpSystolic?: number
  bpDiastolic?: number
  bloodSugarRandom?: number
  cbacScore?: number
  diabetesRisk?: string
  hypertensionRisk?: string
  cardiovascularRisk?: string
  cancerRisk?: string
  referralMade: boolean
}

interface RawNCDScreening {
  id: string
  beneficiary_id: string
  screening_date: string
  bp_systolic?: number | null
  bp_diastolic?: number | null
  blood_sugar_random?: number | null
  cbac_score?: number | null
  diabetes_risk?: string | null
  hypertension_risk?: string | null
  cardiovascular_risk?: string | null
  cancer_risk?: string | null
  referral_made?: boolean
}

function mapScreening(r: RawNCDScreening): NCDScreening {
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    screeningDate: r.screening_date,
    bpSystolic: r.bp_systolic ?? undefined,
    bpDiastolic: r.bp_diastolic ?? undefined,
    bloodSugarRandom: r.blood_sugar_random ?? undefined,
    cbacScore: r.cbac_score ?? undefined,
    diabetesRisk: r.diabetes_risk ?? undefined,
    hypertensionRisk: r.hypertension_risk ?? undefined,
    cardiovascularRisk: r.cardiovascular_risk ?? undefined,
    cancerRisk: r.cancer_risk ?? undefined,
    referralMade: r.referral_made ?? false,
  }
}

export const ncdService = {
  async listScreenings(params: { page?: number; pageSize?: number } = {}): Promise<{ items: NCDScreening[]; total: number }> {
    const { data } = await api.get<{ items: RawNCDScreening[]; total: number }>('/ncd', {
      params: { page: params.page ?? 1, page_size: params.pageSize ?? 100 },
    })
    return { items: data.items.map(mapScreening), total: data.total }
  },

  async createScreening(payload: CreateScreeningPayload): Promise<NCDScreening> {
    const { data } = await api.post<RawNCDScreening>('/ncd', {
      beneficiary_id: payload.beneficiaryId,
      screening_date: payload.screeningDate,
      age_above_30: payload.ageAbove30,
      tobacco_use: payload.tobaccoUse,
      alcohol_use: payload.alcoholUse,
      physical_activity: payload.physicalActivity,
      waist_circumference_cm: payload.waistCircumferenceCm,
      family_history_diabetes: payload.familyHistoryDiabetes,
      family_history_hypertension: payload.familyHistoryHypertension,
      family_history_cancer: payload.familyHistoryCancer,
      known_diabetes: payload.knownDiabetes,
      known_hypertension: payload.knownHypertension,
      known_cancer: payload.knownCancer,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      blood_sugar_random: payload.bloodSugarRandom,
      cbac_score: payload.cbacScore,
      diabetes_risk: payload.diabetesRisk,
      hypertension_risk: payload.hypertensionRisk,
      cardiovascular_risk: payload.cardiovascularRisk,
      cancer_risk: payload.cancerRisk,
      referral_made: payload.referralMade,
      referral_type: payload.referralType,
      referral_facility_id: payload.referralFacilityId,
    })
    return mapScreening(data)
  },
}
