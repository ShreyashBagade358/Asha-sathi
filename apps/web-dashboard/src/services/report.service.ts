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

const ROUTES: Record<ReportKind, string> = {
  maternal: '/reports/maternal-health',
  child: '/reports/child-health',
  immunization: '/reports/immunization',
  ncd: '/reports/ncd',
  incentive: '/reports/incentives',
}

const TITLES: Record<ReportKind, string> = {
  maternal: 'Maternal Health',
  child: 'Child Health',
  immunization: 'Immunization',
  ncd: 'NCD Screening',
  incentive: 'ASHA Incentives',
}

type RawReport = Record<string, unknown>

function periodLabel(raw: RawReport): string {
  const p = raw.period
  if (Array.isArray(p) && p.length === 2) return `${String(p[0])} → ${String(p[1])}`
  return '—'
}

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function tableFrom(kind: ReportKind, columns: string[], row: ReportRow): ReportData {
  return { kind, title: TITLES[kind], columns, rows: [row] }
}

function formatMaternal(raw: RawReport): ReportData {
  return tableFrom('maternal', ['Period', 'Pregnancies Registered', 'ANC Visits', 'PNC Visits', 'High-Risk', 'Institutional Deliveries'], {
    Period: periodLabel(raw),
    'Pregnancies Registered': asNumber(raw.pregnancies_registered),
    'ANC Visits': asNumber(raw.anc_visits),
    'PNC Visits': asNumber(raw.pnc_visits),
    'High-Risk': asNumber(raw.high_risk_pregnancies),
    'Institutional Deliveries': asNumber(raw.institutional_deliveries),
  })
}

function formatChild(raw: RawReport): ReportData {
  return tableFrom('child', ['Period', 'Children Registered', 'Low Birth Weight', 'LBW %'], {
    Period: periodLabel(raw),
    'Children Registered': asNumber(raw.children_registered),
    'Low Birth Weight': asNumber(raw.low_birth_weight),
    'LBW %': asNumber(raw.lbw_pct),
  })
}

function formatImmunization(raw: RawReport): ReportData {
  const per = periodLabel(raw)
  const byVaccine = Array.isArray(raw.by_vaccine) ? raw.by_vaccine.map((v) => v as { vaccine_code?: string; doses?: number }) : []
  const columns = ['Period', 'Vaccine', 'Doses Given']
  const rows =
    byVaccine.length > 0
      ? byVaccine.map((v) => ({ Period: per, Vaccine: String(v.vaccine_code ?? '—'), 'Doses Given': asNumber(v.doses) }))
      : [{ Period: per, Vaccine: 'Total', 'Doses Given': asNumber(raw.doses_given), }]
  return { kind: 'immunization', title: TITLES.immunization, columns, rows }
}

function formatNcd(raw: RawReport): ReportData {
  return tableFrom('ncd', ['Period', 'Screenings', 'Referred', 'High BP', 'High Random Sugar'], {
    Period: periodLabel(raw),
    Screenings: asNumber(raw.screenings),
    Referred: asNumber(raw.referred),
    'High BP': asNumber(raw.high_bp),
    'High Random Sugar': asNumber(raw.high_random_sugar),
  })
}

function formatIncentive(raw: RawReport): ReportData {
  const ashas = Array.isArray(raw.ashas) ? raw.ashas.length : 0
  return tableFrom('incentive', ['Period', 'Status', 'Claims', 'Total Amount', 'ASHAs'], {
    Period: periodLabel(raw),
    Status: String(raw.status ?? 'approved'),
    Claims: asNumber(raw.claims),
    'Total Amount': asNumber(raw.total_amount),
    ASHAs: ashas,
  })
}

const FORMATTERS: Record<ReportKind, (raw: RawReport) => ReportData> = {
  maternal: formatMaternal,
  child: formatChild,
  immunization: formatImmunization,
  ncd: formatNcd,
  incentive: formatIncentive,
}

function toDateParam(iso?: string): string | undefined {
  if (!iso) return undefined
  const match = /^\d{4}-\d{2}-\d{2}/.exec(iso)
  return match ? match[0] : undefined
}

export const reportService = {
  async getReport(kind: ReportKind, params: ReportParams = {}): Promise<ReportData> {
    const { data } = await api.get<RawReport>(ROUTES[kind], {
      params: {
        period_start: toDateParam(params.from) || undefined,
        period_end: toDateParam(params.to) || undefined,
      },
    })
    return FORMATTERS[kind](data)
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