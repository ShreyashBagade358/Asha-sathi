import { api } from '@/lib/api'
import type { Paginated, Referral } from '@/types'

export interface ReferralListParams {
  status?: string
  referralType?: string
  page?: number
  pageSize?: number
}

export interface CreateReferralPayload {
  beneficiaryId: string
  referralType?: string
  urgency?: 'routine' | 'urgent' | 'emergency'
  reason?: string
  clinicalSummary?: string
  referredTo?: string
  referredFrom?: string
}

interface RawReferral {
  id: string
  beneficiary_id: string
  referral_type?: string | null
  urgency?: string | null
  reason?: string | null
  clinical_summary?: string | null
  status?: string
  referred_to?: string | null
  referred_from?: string | null
  initiated_at?: string | null
  completed_at?: string | null
}

function mapReferral(r: RawReferral): Referral {
  const status = r.status ?? 'pending'
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    fromFacility: r.referred_from ?? '',
    toFacility: r.referred_to ?? '',
    reason: r.reason ?? '',
    urgency: r.urgency === 'urgent' ? 'urgent' : r.urgency === 'emergency' ? 'emergency' : 'routine',
    status: status === 'accepted' ? 'accepted' : status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'pending',
    referredBy: '',
    referredAt: r.initiated_at ?? '',
    completedAt: r.completed_at ?? undefined,
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

export const referralService = {
  async listReferrals(params: ReferralListParams = {}): Promise<Paginated<Referral>> {
    const { data } = await api.get<{ items: RawReferral[]; total: number; page: number; page_size: number; total_pages: number }>('/referrals', {
      params: {
        status: params.status,
        referral_type: params.referralType,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapReferral) })
  },

  async getReferral(id: string): Promise<Referral> {
    const { data } = await api.get<RawReferral>(`/referrals/${id}`)
    return mapReferral(data)
  },

  async createReferral(payload: CreateReferralPayload): Promise<Referral> {
    const { data } = await api.post<RawReferral>('/referrals', {
      beneficiary_id: payload.beneficiaryId,
      referral_type: payload.referralType,
      urgency: payload.urgency,
      reason: payload.reason,
      clinical_summary: payload.clinicalSummary,
      referred_to: payload.referredTo,
      referred_from: payload.referredFrom,
    })
    return mapReferral(data)
  },

  async updateReferral(id: string, patch: Partial<CreateReferralPayload>): Promise<Referral> {
    const { data } = await api.put<RawReferral>(`/referrals/${id}`, patch)
    return mapReferral(data)
  },

  async acceptReferral(id: string): Promise<Referral> {
    const { data } = await api.post<RawReferral>(`/referrals/${id}/accept`)
    return mapReferral(data)
  },

  async completeReferral(id: string): Promise<Referral> {
    const { data } = await api.post<RawReferral>(`/referrals/${id}/complete`)
    return mapReferral(data)
  },

  async deleteReferral(id: string): Promise<void> {
    await api.delete(`/referrals/${id}`)
  },
}
