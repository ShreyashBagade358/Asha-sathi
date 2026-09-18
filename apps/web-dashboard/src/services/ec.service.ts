import { api } from '@/lib/api'
import type { Paginated } from '@/types'

export interface EligibleCoupleListParams {
  status?: 'active' | 'pregnant' | 'all'
  page?: number
  pageSize?: number
}

export interface EligibleCouple {
  id: string
  husbandId: string
  wifeId: string
  registrationDate: string
  status: string
  currentMethod?: string
  lastFollowupDate?: string
  nextFollowupDate?: string
  pregnancyConfirmed?: boolean
}

export interface CreateEligibleCouplePayload {
  husbandId: string
  wifeId: string
  currentMethod?: string
  registrationDate?: string
}

interface RawEC {
  id: string
  husband_id: string
  wife_id: string
  registration_date?: string | null
  status?: string
  current_method?: string | null
  last_followup_date?: string | null
  next_followup_date?: string | null
  pregnancy_confirmed?: boolean
}

function mapEC(r: RawEC): EligibleCouple {
  return {
    id: r.id,
    husbandId: r.husband_id,
    wifeId: r.wife_id,
    registrationDate: r.registration_date ?? '',
    status: r.status ?? 'active',
    currentMethod: r.current_method ?? undefined,
    lastFollowupDate: r.last_followup_date ?? undefined,
    nextFollowupDate: r.next_followup_date ?? undefined,
    pregnancyConfirmed: r.pregnancy_confirmed ?? false,
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

export const ecService = {
  async listEligibleCouples(params: EligibleCoupleListParams = {}): Promise<Paginated<EligibleCouple>> {
    const { data } = await api.get<{ items: RawEC[]; total: number; page: number; page_size: number; total_pages: number }>('/eligible-couples', {
      params: {
        status: params.status === 'all' ? undefined : params.status,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapEC) })
  },

  async createEligibleCouple(payload: CreateEligibleCouplePayload): Promise<EligibleCouple> {
    const { data } = await api.post<RawEC>('/eligible-couples', {
      husband_id: payload.husbandId,
      wife_id: payload.wifeId,
      current_method: payload.currentMethod,
      registration_date: payload.registrationDate,
    })
    return mapEC(data)
  },

  async deleteEligibleCouple(id: string): Promise<void> {
    await api.delete(`/eligible-couples/${id}`)
  },
}
