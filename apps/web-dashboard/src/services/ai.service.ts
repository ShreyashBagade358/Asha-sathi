import { api } from '@/lib/api'

export type RiskLevel = 'low' | 'moderate' | 'medium' | 'high'

export interface AIPredictionExplanation {
  method?: string
  risk_factors?: string[]
  probabilities?: Record<string, number>
}

export interface AIPrediction {
  id: string
  beneficiaryId: string
  modelName: string
  modelVersion?: string
  prediction: Record<string, unknown> | null
  confidence?: number
  explanation: AIPredictionExplanation | null
  createdAt: string
}

export interface ModelInfo {
  name: string
  version: string
  status: 'available' | 'unavailable'
}

/** `POST /ai/ncd-risk/predict` — `NCDRiskRequest`. */
export interface NcdRiskPayload {
  beneficiaryId: string
  age?: number
  sex?: string
  heightCm?: number
  weightKg?: number
  bmi?: number
  tobaccoUse?: boolean
  alcoholUse?: boolean
  waistCircumferenceCm?: number
  physicalActivity?: 'low' | 'moderate' | 'high'
  familyHistoryDiabetes?: boolean
  familyHistoryHypertension?: boolean
  knownDiabetes?: boolean
  knownHypertension?: boolean
  bpSystolic?: number
  bpDiastolic?: number
  bloodSugarRandom?: number
}

/** `POST /ai/maternal-risk/predict` — `MaternalRiskRequest`. */
export interface MaternalRiskPayload {
  beneficiaryId: string
  age?: number
  gravida?: number
  parity?: number
  gestationalWeeks?: number
  hemoglobin?: number
  bloodSugar?: number
  bpSystolic?: number
  bpDiastolic?: number
  weightKg?: number
  heightCm?: number
  previousCsection?: boolean
  previousPph?: boolean
  previousPreterm?: boolean
  previousStillbirth?: boolean
  multiplePregnancy?: boolean
  ancVisitsAttended?: number
  hasRiskFactors?: boolean
}

interface RawPrediction {
  id: string
  beneficiary_id: string
  model_name: string
  model_version?: string | null
  prediction?: Record<string, unknown> | null
  confidence?: number | null
  explanation?: AIPredictionExplanation | null
  created_at: string
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
  }
}

function dropUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined))
}

export const aiService = {
  /** `GET /ai/predictions` — stored predictions for one beneficiary, newest first. */
  async listPredictions(beneficiaryId: string, limit = 10): Promise<AIPrediction[]> {
    const { data } = await api.get<RawPrediction[]>('/ai/predictions', {
      params: { beneficiary_id: beneficiaryId, limit },
    })
    return data.map(mapPrediction)
  },

  /** `GET /ai/models` — which models this deployment can actually run. */
  async listModels(): Promise<ModelInfo[]> {
    const { data } = await api.get<ModelInfo[]>('/ai/models')
    return data
  },

  async predictNcdRisk(payload: NcdRiskPayload): Promise<AIPrediction> {
    const { data } = await api.post<RawPrediction>(
      '/ai/ncd-risk/predict',
      dropUndefined({
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
    )
    return mapPrediction(data)
  },

  async predictMaternalRisk(payload: MaternalRiskPayload): Promise<AIPrediction> {
    const { data } = await api.post<RawPrediction>(
      '/ai/maternal-risk/predict',
      dropUndefined({
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
    )
    return mapPrediction(data)
  },
}
