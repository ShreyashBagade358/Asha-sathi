import { api } from '@/lib/api'
import type { Paginated, Referral } from '@/types'

export interface ReferralListParams {
  status?: string
  referralType?: string
  urgency?: string
  beneficiaryId?: string
  page?: number
  pageSize?: number
}

export interface ReferralFollowupAll {
  id: string
  referralId: string
  beneficiaryId: string
  reason: string
  referralStatus: string
  followupDate: string | null
  beneficiaryStatus: string | null
  treatmentCompliance: string | null
  notes: string | null
}

export interface RecordFollowupPayload {
  followupDate: string
  beneficiaryStatus?: string
  treatmentCompliance?: string
  notes?: string
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
        urgency: params.urgency,
        beneficiary_id: params.beneficiaryId,
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

  /** Every referral follow-up with its referral row, in one call (no N+1). */
  async listAllFollowups(): Promise<ReferralFollowupAll[]> {
    const { data } = await api.get<
      Array<{
        id: string
        referral_id: string
        beneficiary_id: string
        reason: string | null
        referral_status: string
        followup_date: string | null
        beneficiary_status: string | null
        treatment_compliance: string | null
        notes: string | null
      }>
    >('/referrals/followups/all')
    return data.map((f) => ({
      id: f.id,
      referralId: f.referral_id,
      beneficiaryId: f.beneficiary_id,
      reason: f.reason ?? '',
      referralStatus: f.referral_status,
      followupDate: f.followup_date ?? null,
      beneficiaryStatus: f.beneficiary_status ?? null,
      treatmentCompliance: f.treatment_compliance ?? null,
      notes: f.notes ?? null,
    }))
  },

  async recordReferralFollowup(referralId: string, payload: RecordFollowupPayload): Promise<void> {
    await api.post(`/referrals/${referralId}/followups`, {
      followup_date: payload.followupDate,
      beneficiary_status: payload.beneficiaryStatus,
      treatment_compliance: payload.treatmentCompliance,
      notes: payload.notes,
    })
  },
}
