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

const FALLBACK_ASHAS: ASHAUser[] = [
  { id: 'asha-1', ashaId: 'ASH-4001', name: 'Meena Devi', village: 'Rampur', phone: '9876543210', assignedHouseholds: 84, performanceScore: 91, status: 'active', lastSyncAt: new Date().toISOString() },
  { id: 'asha-2', ashaId: 'ASH-4002', name: 'Kavita Kumari', village: 'Sonpur', phone: '9876543211', assignedHouseholds: 76, performanceScore: 84, status: 'active', lastSyncAt: new Date().toISOString() },
  { id: 'asha-3', ashaId: 'ASH-4003', name: 'Saroj Yadav', village: 'Kandwa', phone: '9876543212', assignedHouseholds: 92, performanceScore: 72, status: 'active', lastSyncAt: new Date(Date.now() - 2 * 864e5).toISOString() },
  { id: 'asha-4', ashaId: 'ASH-4004', name: 'Geeta Devi', village: 'Tikari', phone: '9876543213', assignedHouseholds: 68, performanceScore: 58, status: 'on_leave', lastSyncAt: new Date(Date.now() - 9 * 864e5).toISOString() },
  { id: 'asha-5', ashaId: 'ASH-4005', name: 'Rani Paswan', village: 'Basari', phone: '9876543214', assignedHouseholds: 55, performanceScore: 66, status: 'inactive', lastSyncAt: new Date(Date.now() - 21 * 864e5).toISOString() },
]

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
    try {
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
    } catch (err) {
      console.warn('listASHAs fallback', err)
      const { search, village, status, page = 1, pageSize = 10 } = params
      let items = FALLBACK_ASHAS.filter((a) => {
        if (status && status !== 'all' && a.status !== status) return false
        if (village && a.village !== village) return false
        if (search) {
          const q = search.toLowerCase()
          if (!a.name.toLowerCase().includes(q) && !a.ashaId.toLowerCase().includes(q) && !a.phone.includes(q)) {
            return false
          }
        }
        return true
      })
      const start = (page - 1) * pageSize
      items = items.slice(start, start + pageSize)
      return { items, total: FALLBACK_ASHAS.length, page, pageSize, totalPages: Math.ceil(FALLBACK_ASHAS.length / pageSize) }
    }
  },

  async getASHADetail(ashaId: string): Promise<ASHADetail> {
    try {
      const { data } = await api.get<{ asha: RawASHAUser; kpis: RawASHAKPI[]; villages: string[]; assigned_beneficiaries: number }>(`/ashas/${ashaId}`)
      const asha = mapASHAUser(data.asha)
      return {
        asha,
        villages: data.villages ?? [],
        assignedBeneficiaries: data.assigned_beneficiaries ?? 0,
        kpis: (data.kpis ?? []).map((k) => mapASHAKPI(k, asha.name, asha.village)),
      }
    } catch (err) {
      console.warn('getASHADetail fallback', err)
      const asha = FALLBACK_ASHAS.find((a) => a.ashaId === ashaId) ?? FALLBACK_ASHAS[0]
      return {
        asha,
        villages: [asha.village],
        assignedBeneficiaries: asha.assignedHouseholds * 2,
        kpis: [
          { ashaId, ashaName: asha.name, phcId: 'phc-demo', village: asha.village, period: 'Dec', pregnantWomenRegistered: 8, anc4PlusCompleted: 5, institutionalDeliveries: 4, immunizationCoverage: 86, hrpIdentified: 2, ncdScreened: 64, homeVisits: 52, incentiveEarned: 3100, performanceScore: asha.performanceScore },
        ],
      }
    }
  },

  async getASHAKPIs(ashaId: string): Promise<ASHAKPI[]> {
    try {
      const { data } = await api.get<RawASHAKPI[]>(`/ashas/${ashaId}/kpis`)
      const asha = FALLBACK_ASHAS.find((a) => a.ashaId === ashaId)
      const name = asha?.name ?? 'ASHA'
      const village = asha?.village ?? ''
      return data.map((k) => mapASHAKPI(k, name, village))
    } catch (err) {
      console.warn('getASHAKPIs fallback', err)
      return [
        { ashaId, ashaName: 'Meena Devi', phcId: 'phc-demo', village: 'Rampur', period: 'Dec', pregnantWomenRegistered: 8, anc4PlusCompleted: 5, institutionalDeliveries: 4, immunizationCoverage: 86, hrpIdentified: 2, ncdScreened: 64, homeVisits: 52, incentiveEarned: 3100, performanceScore: 91 },
      ]
    }
  },

  async updateASHA(ashaId: string, patch: Partial<ASHAUser>): Promise<ASHAUser> {
    try {
      const { data } = await api.patch<RawASHAUser>(`/ashas/${ashaId}`, {
        name: patch.name,
        phone: patch.phone,
        village: patch.village,
        status: patch.status,
        performance_score: patch.performanceScore,
      })
      return mapASHAUser(data)
    } catch (err) {
      console.warn('updateASHA fallback', err)
      const base = FALLBACK_ASHAS.find((a) => a.ashaId === ashaId) ?? FALLBACK_ASHAS[0]
      return { ...base, ...patch }
    }
  },

  async createASHA(payload: Omit<ASHAUser, 'id' | 'ashaId' | 'performanceScore'>): Promise<ASHAUser> {
    try {
      const { data } = await api.post<RawASHAUser>('/ashas', {
        name: payload.name,
        phone: payload.phone,
        village: payload.village,
        status: payload.status,
      })
      return mapASHAUser(data)
    } catch (err) {
      console.warn('createASHA fallback', err)
      return {
        ...payload,
        id: `asha-${Date.now()}`,
        ashaId: `ASH-${4006 + FALLBACK_ASHAS.length}`,
        performanceScore: 0,
      }
    }
  },

  async assignVillages(ashaId: string, villages: string[]): Promise<ASHAUser> {
    try {
      const { data } = await api.post<RawASHAUser>(`/ashas/${ashaId}/villages`, { villages })
      return mapASHAUser(data)
    } catch (err) {
      console.warn('assignVillages fallback', err)
      const base = FALLBACK_ASHAS.find((a) => a.ashaId === ashaId) ?? FALLBACK_ASHAS[0]
      return { ...base, village: villages[0] ?? base.village }
    }
  },
}
