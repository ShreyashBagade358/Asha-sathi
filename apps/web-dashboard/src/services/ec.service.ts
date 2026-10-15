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
        status: params.status ?? 'all',
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapEC) })
  },


  async deleteEligibleCouple(id: string): Promise<void> {
    await api.delete(`/eligible-couples/${id}`)
  },

  async updateEligibleCouple(id: string, payload: Partial<CreateEligibleCouplePayload> & { status?: string; nextFollowupDate?: string; lastFollowupDate?: string; pregnancyConfirmed?: boolean }): Promise<EligibleCouple> {
    const body: Record<string, unknown> = {}
    if (payload.status !== undefined) body.status = payload.status
    if (payload.currentMethod !== undefined) body.current_method = payload.currentMethod
    if (payload.nextFollowupDate !== undefined) body.next_followup_date = payload.nextFollowupDate
    if (payload.lastFollowupDate !== undefined) body.last_followup_date = payload.lastFollowupDate
    if (payload.pregnancyConfirmed !== undefined) body.pregnancy_confirmed = payload.pregnancyConfirmed
    const { data } = await api.put<RawEC>(`/eligible-couples/${id}`, body)
    return mapEC(data)
  },

  async recordFollowup(id: string, payload: { followupDate: string; methodUsed?: string; counselingGiven?: boolean }): Promise<void> {
    await api.post(`/eligible-couples/${id}/followups`, {
      followup_date: payload.followupDate,
      method_used: payload.methodUsed,
      counseling_given: payload.counselingGiven ?? true,
    })
  },
}
