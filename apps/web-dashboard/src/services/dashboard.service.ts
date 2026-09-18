import { api } from '@/lib/api'
import type {
  ASHAKPI,
  DashboardKPIs,
  HRPAlert,
  PHCComparisonRow,
  SyncRecord,
} from '@/types'

export interface CoveragePoint {
  label: string
  anc4: number
  institutional: number
  immunization: number
  ncd: number
}

export interface VillageCoverage {
  village: string
  anc4: number
  immunization: number
  ncd: number
}

export interface PHCDashboard {
  kpis: DashboardKPIs
  coverageTrend: CoveragePoint[]
  villageCoverage: VillageCoverage[]
  hrpAlerts: HRPAlert[]
  recentSyncs: SyncRecord[]
  ashaPerformance: ASHAKPI[]
}

export interface ResourceUtilization {
  phcId: string
  phcName: string
  staffFillRate: number
  vaccineStockPct: number
  equipmentUtilization: number
}

export interface DistrictDashboard {
  kpis: DashboardKPIs
  phcComparison: PHCComparisonRow[]
  coverageTrend: CoveragePoint[]
  resourceUtilization: ResourceUtilization[]
}

export interface FocusArea {
  districtId: string
  districtName: string
  laggingIndicator: string
  gapPct: number
}

export interface StateDashboard {
  kpis: DashboardKPIs
  districtComparison: PHCComparisonRow[]
  trend: Array<{ label: string; value: number }>
  focusAreas: FocusArea[]
}

type BundleKPIs = Record<string, number | undefined>

function mapBundleKPIs(raw: BundleKPIs): DashboardKPIs {
  const num = (k: string): number => Number(raw[k]) || 0
  const pregnancies = num('pregnancies')
  const beneficiaries = num('beneficiaries')
  const pct = (part: number, whole: number): number => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0)
  return {
    period: '',
    totalPregnancies: pregnancies,
    activePregnancies: pregnancies,
    hrpActive: num('hrp_active'),
    anc4Coverage: pct(num('anc_visits'), pregnancies * 3),
    institutionalDeliveryRate: pct(num('deliveries'), pregnancies),
    immunizationCoverage: pct(num('immunizations'), beneficiaries),
    ncdScreened: num('ncd_screenings'),
    ncdPositive: num('ncd_positive'),
    homeVisits: num('home_visits'),
    incentivesPaid: num('incentives'),
    ashaCount: num('ashas'),
    villageCount: 0,
    beneficiaryCount: beneficiaries,
  }
}

function mapGlobalKPIs(kpis: Array<{ key: string; label: string; value: number }>): DashboardKPIs {
  const byKey: BundleKPIs = {}
  for (const item of kpis) byKey[item.key] = item.value
  return mapBundleKPIs(byKey)
}

export const dashboardService = {
  async getPHCDashboard(phcId: string): Promise<PHCDashboard> {
    const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/phc', {
      params: { phc_id: phcId },
    })
    return {
      kpis: mapBundleKPIs(data.kpis),
      coverageTrend: [],
      villageCoverage: [],
      hrpAlerts: [],
      recentSyncs: [],
      ashaPerformance: [],
    }
  },

  async getDistrictDashboard(districtId: string): Promise<DistrictDashboard> {
    const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/district', {
      params: { district_id: districtId },
    })
    return {
      kpis: mapBundleKPIs(data.kpis),
      phcComparison: [],
      coverageTrend: [],
      resourceUtilization: [],
    }
  },

  async getStateDashboard(): Promise<StateDashboard> {
    const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/state')
    return {
      kpis: mapBundleKPIs(data.kpis),
      districtComparison: [],
      trend: [],
      focusAreas: [],
    }
  },

  async getKPIs(): Promise<DashboardKPIs> {
    const { data } = await api.get<{ scope: string; date: string; kpis: Array<{ key: string; label: string; value: number }> }>('/dashboard/kpis')
    return mapGlobalKPIs(data.kpis)
  },
}
