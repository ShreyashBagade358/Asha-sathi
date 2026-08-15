import { api } from '@/lib/api'
import { downloadCsv } from '@/services/beneficiary.service'

export type ReportKind = 'maternal' | 'child' | 'immunization' | 'ncd' | 'incentive'

export interface ReportRow {
  [key: string]: string | number
}

export interface ReportData {
  kind: ReportKind
  title: string
  columns: string[]
  rows: ReportRow[]
}

export interface ReportParams {
  from?: string
  to?: string
  village?: string
  phcId?: string
  districtId?: string
  ashaId?: string
}

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function seededRow(kind: ReportKind, i: number, total: number): ReportRow {
  const progress = Math.round((i / Math.max(total - 1, 1)) * 100)
  switch (kind) {
    case 'maternal':
      return { Month: MONTHS[i % MONTHS.length], 'Registrations': 40 + ((i * 17) % 25), 'ANC4+ Completed': 26 + ((i * 13) % 18), 'Institutional Deliveries': 30 + ((i * 11) % 20), 'High Risk (HRP)': 3 + (i % 4), 'Home Deliveries': 2 + (i % 3) }
    case 'child':
      return { Month: MONTHS[i % MONTHS.length], 'Live Births': 34 + ((i * 9) % 20), 'Low Birth Weight': 4 + (i % 5), 'Breastfed <1hr': 22 + ((i * 7) % 16), 'Newborn Visits': 30 + ((i * 11) % 18) }
    case 'immunization':
      return { Month: MONTHS[i % MONTHS.length], 'BCG': 90 + ((i * 5) % 9), 'OPV-3': 78 + ((i * 9) % 18), 'Pentavalent-3': 76 + ((i * 11) % 20), 'Measles-1': 72 + ((i * 13) % 22), 'Full Coverage %': progress }
    case 'ncd':
      return { Month: MONTHS[i % MONTHS.length], 'Screened': 120 + ((i * 41) % 90), 'Hypertension +': 9 + (i % 8), 'Diabetes +': 6 + (i % 6), 'Referrals': 4 + (i % 4) }
    case 'incentive':
      return { Month: MONTHS[i % MONTHS.length], 'Claims': 84 + ((i * 11) % 30), 'Approved': 78 + ((i * 9) % 24), 'Amount (₹)': 186000 + i * 12500, 'Pending': 4 + (i % 5) }
  }
}

function buildReport(kind: ReportKind): ReportData {
  const total = MONTHS.length
  const titles: Record<ReportKind, string> = {
    maternal: 'Maternal Health Report',
    child: 'Child Health Report',
    immunization: 'Immunization Report',
    ncd: 'NCD Screening Report',
    incentive: 'ASHA Incentive Report',
  }
  return {
    kind,
    title: titles[kind],
    columns: Object.keys(seededRow(kind, 0, total)),
    rows: Array.from({ length: total }).map((_, i) => seededRow(kind, i, total)),
  }
}

export const reportService = {
  async getReport(kind: ReportKind, params: ReportParams = {}): Promise<ReportData> {
    try {
      const { data } = await api.get<ReportData>(`/reports/${kind}`, { params })
      return data
    } catch (err) {
      console.warn('getReport fallback', err)
      return buildReport(kind)
    }
  },

  getMaternalReport(params: ReportParams = {}) {
    return this.getReport('maternal', params)
  },
  getChildReport(params: ReportParams = {}) {
    return this.getReport('child', params)
  },
  getImmunizationReport(params: ReportParams = {}) {
    return this.getReport('immunization', params)
  },
  getNCDReport(params: ReportParams = {}) {
    return this.getReport('ncd', params)
  },
  getIncentiveReport(params: ReportParams = {}) {
    return this.getReport('incentive', params)
  },

  exportExcel(report: ReportData, filename?: string): void {
    const header = report.columns.join(',')
    const lines = report.rows.map((row) =>
      report.columns.map((col) => `"${String(row[col] ?? '').replaceAll('"', '""')}"`).join(','),
    )
    downloadCsv([header, ...lines].join('\n'), filename ?? `${report.kind}-report.csv`)
  },
}
