import { api } from '@/lib/api'
import type { ANCVisit, Paginated, Pregnancy } from '@/types'

export interface PregnancyListParams {
  status?: 'ongoing' | 'delivered' | 'aborted' | 'ltf' | 'all'
  page?: number
  pageSize?: number
}

export interface CreatePregnancyPayload {
  beneficiaryId: string
  lmp?: string
  edd?: string
  gravida?: number
  parity?: number
  riskLevel?: 'low' | 'medium' | 'high'
  riskFactors?: Record<string, unknown>
}

export interface CreateANCVisitPayload {
  visitNumber?: number
  visitDate: string
  bpSystolic?: number
  bpDiastolic?: number
  weightKg?: number
  heightCm?: number
  hemoglobin?: number
  fundalHeightCm?: number
  fetalHeartRate?: number
  dangerSigns?: string[]
}

interface RawPregnancy {
  id: string
  beneficiary_id: string
  lmp?: string | null
  edd?: string | null
  gravida?: number | null
  parity?: number | null
  risk_level?: string | null
  risk_factors?: Record<string, unknown> | null
  last_anc_date?: string | null
  next_anc_due?: string | null
  anc_count?: number
  status?: string
  created_at?: string
}

interface RawANC {
  id: string
  pregnancy_id: string
  visit_number?: number
  visit_date?: string
  gestation_week?: number
  bp_systolic?: number | null
  bp_diastolic?: number | null
  weight_kg?: number | null
  hemoglobin?: number | null
  fundal_height_cm?: number | null
  fetal_heart_rate?: number | null
  hrp_flag?: boolean
}

export function mapPregnancy(r: RawPregnancy): Pregnancy {
  const risk = r.risk_level ?? 'low'
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    lmp: r.lmp ?? '',
    edd: r.edd ?? '',
    gravida: r.gravida ?? 0,
    para: r.parity ?? 0,
    status: r.status === 'delivered' ? 'delivered' : r.status === 'aborted' ? 'aborted' : r.status === 'ltf' ? 'ltf' : 'active',
    highRisk: risk !== 'low' || Object.keys(r.risk_factors ?? {}).length > 0,
    hrpLevel: risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : undefined,
    complications: Array.isArray(r.risk_factors) ? r.risk_factors : Object.keys(r.risk_factors ?? {}),
    registeredAt: r.created_at ?? '',
  }
}

function mapANC(r: RawANC, beneficiaryId: string): ANCVisit {
  return {
    id: r.id,
    pregnancyId: r.pregnancy_id,
    beneficiaryId,
    visitNumber: r.visit_number ?? 1,
    date: r.visit_date ?? '',
    gestationWeek: r.gestation_week ?? 0,
    weightKg: r.weight_kg ?? undefined,
    bpSystolic: r.bp_systolic ?? undefined,
    bpDiastolic: r.bp_diastolic ?? undefined,
    haemoglobin: r.hemoglobin ?? undefined,
    fundalHeight: r.fundal_height_cm ?? undefined,
    foetalHeartRate: r.fetal_heart_rate ?? undefined,
    hrpFlag: r.hrp_flag ?? false,
  }
}

function mapPaginated<T>(raw: { items: T[]; total: number; page: number; page_size: number; total_pages: number }): Paginated<T> {
  return {
    items: raw.items,
    total: raw.total,
    page: raw.page,
    pageSize: raw.page_size,
    totalPages: raw.total_pages,
  }
}

export const pregnancyService = {
  async listPregnancies(params: PregnancyListParams = {}): Promise<Paginated<Pregnancy>> {
    const { data } = await api.get<{ items: RawPregnancy[]; total: number; page: number; page_size: number; total_pages: number }>('/pregnancies', {
      params: {
        status: params.status === 'all' ? undefined : params.status,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapPregnancy) })
  },

  async getPregnancy(id: string): Promise<Pregnancy> {
    const { data } = await api.get<RawPregnancy>(`/pregnancies/${id}`)
    return mapPregnancy(data)
  },

  async createPregnancy(payload: CreatePregnancyPayload): Promise<Pregnancy> {
    const { data } = await api.post<RawPregnancy>('/pregnancies', {
      beneficiary_id: payload.beneficiaryId,
      lmp: payload.lmp,
      edd: payload.edd,
      gravida: payload.gravida,
      parity: payload.parity,
      risk_level: payload.riskLevel,
      risk_factors: payload.riskFactors,
    })
    return mapPregnancy(data)
  },

  async addANCVisit(pregnancyId: string, payload: CreateANCVisitPayload): Promise<ANCVisit> {
    const { data } = await api.post<RawANC>(`/pregnancies/${pregnancyId}/anc`, {
      visit_number: payload.visitNumber,
      visit_date: payload.visitDate,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      weight_kg: payload.weightKg,
      height_cm: payload.heightCm,
      hemoglobin: payload.hemoglobin,
      fundal_height_cm: payload.fundalHeightCm,
      fetal_heart_rate: payload.fetalHeartRate,
      danger_signs: payload.dangerSigns,
    })
    return mapANC(data, '')
  },

  async listANCVisits(pregnancyId: string, beneficiaryId = ''): Promise<ANCVisit[]> {
    const { data } = await api.get<RawANC[]>(`/pregnancies/${pregnancyId}/anc`)
    return data.map((v) => mapANC(v, beneficiaryId))
  },

  async deletePregnancy(id: string): Promise<void> {
    await api.delete(`/pregnancies/${id}`)
  },
}
