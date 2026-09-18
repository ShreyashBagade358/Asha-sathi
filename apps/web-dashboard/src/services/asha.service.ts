import { api } from '@/lib/api'
import type { ASHAKPI, Paginated } from '@/types'

export type ASHAStatus = 'active' | 'inactive' | 'on_leave'

export interface ASHAUser {
  id: string
  ashaId: string
  name: string
  village: string
  phone: string
  assignedHouseholds: number
  performanceScore: number
  status: ASHAStatus
  lastSyncAt?: string
}

export interface ASHADetail {
  asha: ASHAUser
  kpis: ASHAKPI[]
  villages: string[]
  assignedBeneficiaries: number
}

export interface ListASHAParams {
  search?: string
  village?: string
  status?: ASHAStatus | 'all'
  page?: number
  pageSize?: number
}

export interface CreateASHPayload {
  name: string
  phone: string
  village?: string
  email?: string
  date_of_birth?: string
  gender?: 'female' | 'male' | 'other'
  aadhaar?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  sub_center?: string
  date_of_joining?: string
}

interface RawASHAUser {
  id: string
  asha_id: string
  name: string
  village?: string | null
  phone: string
  assigned_households?: number | null
  performance_score?: number | null
  status?: string
  last_sync_at?: string | null
}

interface RawASHAKPI {
  id: string
  asha_id: string
  period_start: string
  pregnancy_registered?: number
  anc_visits?: number
  institutional_deliveries?: number
  full_immunization_children?: number
  high_risk_pregnancies_identified?: number
  ncd_screenings?: number
  hbnc_visits?: number
  hbyc_visits?: number
  incentives_earned?: number
  performance_score?: number | null
}

const NORMALIZED_STATUS: Record<string, ASHAStatus> = {
  active: 'active',
  on_leave: 'on_leave',
  inactive: 'inactive',
}

function mapASHAUser(r: RawASHAUser): ASHAUser {
  return {
    id: r.id,
    ashaId: r.asha_id,
    name: r.name,
    village: r.village ?? '',
    phone: r.phone,
    assignedHouseholds: r.assigned_households ?? 0,
    performanceScore: r.performance_score ?? 0,
    status: NORMALIZED_STATUS[r.status ?? 'inactive'] ?? 'inactive',
    lastSyncAt: r.last_sync_at ?? undefined,
  }
}

function shortMonth(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en', { month: 'short' })
}

function mapASHAKPI(r: RawASHAKPI, name: string, village: string): ASHAKPI {
  return {
    ashaId: r.asha_id,
    ashaName: name,
    phcId: 'phc-demo',
    village,
    period: shortMonth(r.period_start),
    pregnantWomenRegistered: r.pregnancy_registered ?? 0,
    anc4PlusCompleted: r.anc_visits ?? 0,
    institutionalDeliveries: r.institutional_deliveries ?? 0,
    immunizationCoverage: r.full_immunization_children ?? 0,
    hrpIdentified: r.high_risk_pregnancies_identified ?? 0,
    ncdScreened: r.ncd_screenings ?? 0,
    homeVisits: (r.hbnc_visits ?? 0) + (r.hbyc_visits ?? 0),
    incentiveEarned: r.incentives_earned ?? 0,
    performanceScore: r.performance_score ?? 0,
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

export const ashaService = {
  async listASHAs(params: ListASHAParams = {}): Promise<Paginated<ASHAUser>> {
    const { data } = await api.get<{ items: RawASHAUser[]; total: number; page: number; page_size: number; total_pages: number }>('/ashas', {
      params: {
        q: params.search || undefined,
        village: params.village || undefined,
        status: params.status === 'all' ? undefined : params.status,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapASHAUser) })
  },

  async getASHADetail(ashaId: string): Promise<ASHADetail> {
    const { data } = await api.get<{ asha: RawASHAUser; kpis: RawASHAKPI[]; villages: string[]; assigned_beneficiaries: number }>(`/ashas/${ashaId}`)
    const asha = mapASHAUser(data.asha)
    return {
      asha,
      villages: data.villages ?? [],
      assignedBeneficiaries: data.assigned_beneficiaries ?? 0,
      kpis: (data.kpis ?? []).map((k) => mapASHAKPI(k, asha.name, asha.village)),
    }
  },

  async getASHAKPIs(ashaId: string, name = 'ASHA', village = ''): Promise<ASHAKPI[]> {
    const { data } = await api.get<RawASHAKPI[]>(`/ashas/${ashaId}/kpis`)
    return data.map((k) => mapASHAKPI(k, name, village))
  },

  async updateASHA(ashaId: string, patch: Partial<ASHAUser>): Promise<ASHAUser> {
    const { data } = await api.patch<RawASHAUser>(`/ashas/${ashaId}`, {
      name: patch.name,
      phone: patch.phone,
      village: patch.village,
      status: patch.status,
      performance_score: patch.performanceScore,
    })
    return mapASHAUser(data)
  },

  async createASHA(payload: CreateASHPayload): Promise<ASHAUser> {
    const { data } = await api.post<RawASHAUser>('/ashas', {
      name: payload.name,
      phone: payload.phone,
      village: payload.village,
      email: payload.email || undefined,
      date_of_birth: payload.date_of_birth || undefined,
      gender: payload.gender || undefined,
      aadhaar: payload.aadhaar || undefined,
      emergency_contact_name: payload.emergency_contact_name || undefined,
      emergency_contact_phone: payload.emergency_contact_phone || undefined,
      sub_center: payload.sub_center || undefined,
      date_of_joining: payload.date_of_joining || undefined,
    })
    return mapASHAUser(data)
  },

  async assignVillages(ashaId: string, villages: string[]): Promise<ASHAUser> {
    const { data } = await api.post<RawASHAUser>(`/ashas/${ashaId}/villages`, { villages })
    return mapASHAUser(data)
  },
}
