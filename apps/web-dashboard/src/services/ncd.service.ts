import { api } from '@/lib/api'
import type { Paginated } from '@/types'

export interface NCDListParams {
  page?: number
  pageSize?: number
}

export interface NCDScreening {
  id: string
  beneficiaryId: string
  screeningDate: string
  cbacScore?: number
  diabetesRisk?: string
  hypertensionRisk?: string
  cardiovascularRisk?: string
  cancerRisk?: string
  referralMade?: boolean
}

export interface CreateNCDScreeningPayload {
  beneficiaryId: string
  screeningDate: string
  cbacFields?: Record<string, unknown>
  bp?: string
  bloodSugar?: string
  referralMade?: boolean
}

interface RawNCD {
  id: string
  beneficiary_id: string
  screening_date?: string | null
  cbac_score?: number | null
  diabetes_risk?: string | null
  hypertension_risk?: string | null
  cardiovascular_risk?: string | null
  cancer_risk?: string | null
  referral_made?: boolean
}

function mapNCD(r: RawNCD): NCDScreening {
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    screeningDate: r.screening_date ?? '',
    cbacScore: r.cbac_score ?? undefined,
    diabetesRisk: r.diabetes_risk ?? undefined,
    hypertensionRisk: r.hypertension_risk ?? undefined,
    cardiovascularRisk: r.cardiovascular_risk ?? undefined,
    cancerRisk: r.cancer_risk ?? undefined,
    referralMade: r.referral_made ?? false,
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

export const ncdService = {
  async listNCDScreenings(params: NCDListParams = {}): Promise<Paginated<NCDScreening>> {
    const { data } = await api.get<{ items: RawNCD[]; total: number; page: number; page_size: number; total_pages: number }>('/ncd', {
      params: { page: params.page ?? 1, page_size: params.pageSize ?? 10 },
    })
    return mapPaginated({ ...data, items: data.items.map(mapNCD) })
  },

  async createNCDScreening(payload: CreateNCDScreeningPayload): Promise<NCDScreening> {
    const { data } = await api.post<RawNCD>('/ncd', {
      beneficiary_id: payload.beneficiaryId,
      screening_date: payload.screeningDate,
      ...payload.cbacFields,
      referral_made: payload.referralMade,
    })
    return mapNCD(data)
  },
}
