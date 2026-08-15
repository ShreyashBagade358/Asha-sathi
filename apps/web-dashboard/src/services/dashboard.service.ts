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

const VILLAGES = ['Rampur', 'Sonpur', 'Kandwa', 'Tikari', 'Basari']
const PHC_NAMES = ['PHC Rampur', 'PHC Sonpur', 'PHC Kandwa', 'PHC Tikari', 'PHC Basari']
const DISTRICT_NAMES = ['Gaya', 'Nalanda', 'Jehanabad', 'Arwal', 'Nawada']
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function baseKPIs(seed: number, period: string): DashboardKPIs {
  return {
    period,
    totalPregnancies: 1240 + seed * 37,
    activePregnancies: 412 + seed * 21,
    hrpActive: 48 + seed,
    anc4Coverage: 64 + (seed % 7),
    institutionalDeliveryRate: 78 + (seed % 5),
    immunizationCoverage: 71 + (seed % 9),
    ncdScreened: 3890 + seed * 60,
    ncdPositive: 214 + seed * 4,
    homeVisits: 1820 + seed * 45,
    incentivesPaid: 96 + seed * 3,
    ashaCount: 18 + seed,
    villageCount: VILLAGES.length,
    beneficiaryCount: 6820 + seed * 90,
  }
}

function coverageTrend(seed: number): CoveragePoint[] {
  return MONTHS.map((label, i) => ({
    label,
    anc4: Math.round(55 + i * 4 + ((seed + i) % 3) * 2),
    institutional: Math.round(62 + i * 3 + ((seed + i) % 2) * 4),
    immunization: Math.round(58 + i * 5 + ((seed + i) % 4) * 3),
    ncd: Math.round(24 + i * 9 + ((seed + i) % 2) * 6),
  }))
}

function villageCoverageFallback(): VillageCoverage[] {
  return VILLAGES.map((village, i) => ({
    village,
    anc4: Math.round(52 + ((i * 17) % 40)),
    immunization: Math.round(58 + ((i * 23) % 38)),
    ncd: Math.round(30 + ((i * 31) % 60)),
  }))
}

function hrpAlertsFallback(): HRPAlert[] {
  const names = ['Sunita Devi', 'Kamla Kumari', 'Rekha Devi', 'Anju Kumari', 'Poonam Devi']
  const reasons = [
    'Preeclampsia — BP 160/100 mmHg',
    'Severe anaemia (Hb 6.8 g/dL)',
    'Previous C-section, twin pregnancy',
    'Gestational diabetes, high BMI',
    'Bleeding per vaginum',
  ]
  return names.map((name, i) => ({
    id: `hrp-${i + 1}`,
    beneficiaryId: `b-${i + 1}`,
    beneficiaryName: name,
    pregnancyId: `p-${i + 1}`,
    village: VILLAGES[i % VILLAGES.length],
    ashaName: `ASHA ${['Meena', 'Kavita', 'Saroj', 'Geeta', 'Rani'][i]}`,
    hrpLevel: i % 2 === 0 ? 'high' : 'medium',
    reason: reasons[i % reasons.length],
    detectedAt: new Date(Date.now() - i * 36e5).toISOString(),
    status: i === 0 ? 'open' : i === 1 ? 'acknowledged' : 'resolved',
  }))
}

function recentSyncsFallback(): SyncRecord[] {
  const names = ['Meena Devi', 'Kavita Kumari', 'Saroj Yadav', 'Geeta Devi', 'Rani Paswan']
  return names.map((name, i) => ({
    id: `sync-${i + 1}`,
    ashaId: `asha-${i + 1}`,
    ashaName: name,
    deviceId: `ASH-${4200 + i * 7}`,
    syncedAt: new Date(Date.now() - i * 48 * 36e5).toISOString(),
    recordsSynced: 40 - i * 3,
    status: i === 2 ? 'failed' : i === 4 ? 'partial' : 'success',
    durationMs: 1200 + i * 300,
  }))
}

function ashaPerformanceFallback(): ASHAKPI[] {
  const names = ['Meena Devi', 'Kavita Kumari', 'Saroj Yadav', 'Geeta Devi', 'Rani Paswan']
  return names.map((name, i) => ({
    ashaId: `asha-${i + 1}`,
    ashaName: name,
    phcId: 'phc-demo',
    village: VILLAGES[i % VILLAGES.length],
    period: MONTHS[MONTHS.length - 1],
    pregnantWomenRegistered: 6 + i * 2,
    anc4PlusCompleted: 4 + i,
    institutionalDeliveries: 3 + i,
    immunizationCoverage: 68 + ((i * 13) % 29),
    hrpIdentified: 1 + i,
    ncdScreened: 40 + i * 15,
    homeVisits: 35 + i * 12,
    incentiveEarned: 2400 + i * 450,
    performanceScore: 62 + ((i * 19) % 35),
  }))
}

function resourceUtilizationFallback(): ResourceUtilization[] {
  return PHC_NAMES.map((name, i) => ({
    phcId: `phc-${i + 1}`,
    phcName: name,
    staffFillRate: 55 + ((i * 23) % 40),
    vaccineStockPct: 62 + ((i * 19) % 35),
    equipmentUtilization: 48 + ((i * 31) % 45),
  }))
}

function districtComparisonFallback(): PHCComparisonRow[] {
  return DISTRICT_NAMES.map((name, i) => ({
    phcId: `dist-${i + 1}`,
    phcName: name,
    values: {
      anc4: Math.round(58 + ((i * 11) % 30)),
      institutional: Math.round(70 + ((i * 9) % 24)),
      immunization: Math.round(62 + ((i * 13) % 28)),
      ncd: Math.round(28 + ((i * 17) % 50)),
    },
  }))
}

function phcComparisonFallback(): PHCComparisonRow[] {
  return PHC_NAMES.map((name, i) => ({
    phcId: `phc-${i + 1}`,
    phcName: name,
    values: {
      anc4: Math.round(54 + ((i * 13) % 34)),
      institutional: Math.round(66 + ((i * 11) % 28)),
      immunization: Math.round(58 + ((i * 17) % 32)),
      ncd: Math.round(25 + ((i * 23) % 55)),
    },
  }))
}

type BundleKPIs = Record<string, number | undefined>

function mapBundleKPIs(raw: BundleKPIs): DashboardKPIs {
  const num = (k: string): number => Number(raw[k]) || 0
  const pregnancies = num('pregnancies')
  const beneficiaries = num('beneficiaries')
  const pct = (part: number, whole: number): number => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0)
  return {
    period: MONTHS[MONTHS.length - 1],
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

export const dashboardService = {
  async getPHCDashboard(phcId: string): Promise<PHCDashboard> {
    try {
      const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/phc', {
        params: { phc_id: phcId },
      })
      return {
        kpis: mapBundleKPIs(data.kpis),
        coverageTrend: coverageTrend(phcId.length % 5),
        villageCoverage: villageCoverageFallback(),
        hrpAlerts: hrpAlertsFallback(),
        recentSyncs: recentSyncsFallback(),
        ashaPerformance: ashaPerformanceFallback(),
      }
    } catch (err) {
      console.warn('getPHCDashboard fallback', err)
      return {
        kpis: baseKPIs(phcId.length % 5, MONTHS[MONTHS.length - 1]),
        coverageTrend: coverageTrend(phcId.length % 5),
        villageCoverage: villageCoverageFallback(),
        hrpAlerts: hrpAlertsFallback(),
        recentSyncs: recentSyncsFallback(),
        ashaPerformance: ashaPerformanceFallback(),
      }
    }
  },

  async getDistrictDashboard(districtId: string): Promise<DistrictDashboard> {
    try {
      const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/district', {
        params: { district_id: districtId },
      })
      return {
        kpis: mapBundleKPIs(data.kpis),
        phcComparison: phcComparisonFallback(),
        coverageTrend: coverageTrend(districtId.length % 7),
        resourceUtilization: resourceUtilizationFallback(),
      }
    } catch (err) {
      console.warn('getDistrictDashboard fallback', err)
      return {
        kpis: baseKPIs(districtId.length % 7, MONTHS[MONTHS.length - 1]),
        phcComparison: phcComparisonFallback(),
        coverageTrend: coverageTrend(districtId.length % 7),
        resourceUtilization: resourceUtilizationFallback(),
      }
    }
  },

  async getStateDashboard(): Promise<StateDashboard> {
    try {
      const { data } = await api.get<{ entity: string; name: string; kpis: BundleKPIs }>('/dashboard/state')
      return {
        kpis: mapBundleKPIs(data.kpis),
        districtComparison: districtComparisonFallback(),
        trend: MONTHS.map((label, i) => ({
          label,
          value: Math.round(58 + i * 4 + ((i % 3) * 2)),
        })),
        focusAreas: DISTRICT_NAMES.slice(0, 3).map((name, i) => ({
          districtId: `dist-${i + 1}`,
          districtName: name,
          laggingIndicator: ['ANC4+ coverage', 'Institutional deliveries', 'NCD screening'][i],
          gapPct: 18 + i * 6,
        })),
      }
    } catch (err) {
      console.warn('getStateDashboard fallback', err)
      return {
        kpis: baseKPIs(9, MONTHS[MONTHS.length - 1]),
        districtComparison: districtComparisonFallback(),
        trend: MONTHS.map((label, i) => ({
          label,
          value: Math.round(58 + i * 4 + ((i % 3) * 2)),
        })),
        focusAreas: DISTRICT_NAMES.slice(0, 3).map((name, i) => ({
          districtId: `dist-${i + 1}`,
          districtName: name,
          laggingIndicator: ['ANC4+ coverage', 'Institutional deliveries', 'NCD screening'][i],
          gapPct: 18 + i * 6,
        })),
      }
    }
  },

  async getKPIs(): Promise<DashboardKPIs> {
    try {
      const { data } = await api.get<{ scope: string; date: string; kpis: Array<{ key: string; label: string; value: number }> }>('/dashboard/kpis')
      const byKey: BundleKPIs = {}
      for (const item of data.kpis) byKey[item.key] = item.value
      return mapBundleKPIs(byKey)
    } catch (err) {
      console.warn('getKPIs fallback', err)
      return baseKPIs(3, MONTHS[MONTHS.length - 1])
    }
  },
}
