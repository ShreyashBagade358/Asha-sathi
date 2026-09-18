import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { reportService, type ReportKind } from '@/services/report.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { ashaService } from '@/services/asha.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const REPORT_KINDS: Array<{ kind: ReportKind; title: string; desc: string; icon: string }> = [
  { kind: 'maternal', title: 'Maternal Health', desc: 'ANC visits, deliveries, and high-risk mothers.', icon: 'pregnant_woman' },
  { kind: 'child', title: 'Child Health', desc: 'Growth tracking and child health indicators.', icon: 'child_care' },
  { kind: 'immunization', title: 'Immunization', desc: 'Vaccination coverage and due doses.', icon: 'vaccines' },
  { kind: 'ncd', title: 'NCD Screening', desc: 'Screening, positives, and follow-ups.', icon: 'monitor_heart' },
  { kind: 'incentive', title: 'ASHA Incentives', desc: 'Payments earned per completed activity.', icon: 'payments' },
]

const PERIODS = [
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'year', label: 'This Year' },
]

function periodRange(period: string): { from?: string; to?: string } {
  const now = new Date()
  const to = now.toISOString()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return { from, to }
  }
  if (period === '30d') {
    const from = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    return { from, to }
  }
  return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to }
}

export default function ReportCenterPhcAdmin() {
  const [period, setPeriod] = useState('month')
  const [village, setVillage] = useState('')
  const [ashaId, setAshaId] = useState('')
  const [active, setActive] = useState<ReportKind | null>(null)

  const villagesQ = useQuery({
    queryKey: ['villages', 'list-for-report'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const ashasQ = useQuery({
    queryKey: ['ashas', 'all'],
    queryFn: () => ashaService.listASHAs({ pageSize: 1000 }),
  })

  const villages = Array.from(new Set((villagesQ.data?.items ?? []).map((b) => b.village).filter(Boolean)))
  const ashas = ashasQ.data?.items ?? []

  const preview = useQuery({
    queryKey: ['report', active, period, village, ashaId],
    queryFn: () =>
      reportService.getReport(active as ReportKind, {
        ...periodRange(period),
        village: village || undefined,
        ashaId: ashaId || undefined,
      }),
    enabled: active !== null,
  })

  const selectCls =
    'w-full h-12 rounded-lg border border-outline-variant bg-surface px-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary appearance-none'

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">description</span>
              Report Center
            </h2>
            <p className="text-caption text-on-surface-variant">Generate and download programmatic health reports.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col lg:flex-row gap-md lg:items-end">
            <div className="flex-none">
              <label className="block text-label-md text-on-surface-variant mb-1">Period</label>
              <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-4 py-2 rounded-md text-label-sm font-semibold transition-colors ${
                      period === p.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-label-md text-on-surface-variant mb-1">Village</label>
              <div className="relative">
                <select className={selectCls} value={village} onChange={(e) => setVillage(e.target.value)}>
                  <option value="">All Villages</option>
                  {villages.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant pointer-events-none">
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-label-md text-on-surface-variant mb-1">ASHA Worker</label>
              <div className="relative">
                <select className={selectCls} value={ashaId} onChange={(e) => setAshaId(e.target.value)}>
                  <option value="">All Workers</option>
                  {ashas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.village ? ` (${a.village})` : ''}</option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant pointer-events-none">
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
            {REPORT_KINDS.map((r) => {
              const isActive = active === r.kind
              return (
                <button
                  key={r.kind}
                  onClick={() => setActive(isActive ? null : r.kind)}
                  className={`text-left bg-surface-container-lowest border rounded-xl p-5 flex flex-col gap-sm transition-all hover:shadow-md ${
                    isActive ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`p-sm rounded-lg w-fit ${isActive ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                      <span className="material-symbols-outlined">{r.icon}</span>
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                      {isActive ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-headline-md text-on-surface">{r.title}</h3>
                    <p className="text-caption text-on-surface-variant">{r.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {active && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center gap-3 flex-wrap">
                <h3 className="text-headline-md text-on-surface">Preview — {REPORT_KINDS.find((r) => r.kind === active)?.title}</h3>
                <button
                  onClick={() => {
                    if (!preview.data) return
                    reportService.exportExcel(preview.data)
                  }}
                  disabled={!preview.data}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download CSV
                </button>
              </div>
              <div className="p-5">
                {preview.isLoading && <LoadingState label="Generating report…" />}
                {preview.isError && <ErrorState message={getErrorMessage(preview.error)} onRetry={() => preview.refetch()} />}
                {preview.data && preview.data.rows.length === 0 && (
                  <EmptyState title="No data for this period" description="Try widening the period or clearing the filters." icon="description" />
                )}
                {preview.data && preview.data.rows.length > 0 && (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[520px]">
                      <thead className="sticky top-0 bg-surface-container/95 backdrop-blur">
                        <tr className="border-b border-outline-variant">
                          {preview.data.columns.map((c) => (
                            <th key={c} className="px-3 py-2.5 text-label-md font-semibold text-on-surface-variant whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.data.rows.map((row, i) => (
                          <tr key={i} className={`border-b border-outline-variant/40 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-container/40'}`}>
                            {preview.data!.columns.map((c) => (
                              <td key={c} className="px-3 py-2.5 text-label-sm text-on-surface whitespace-nowrap">{String(row[c] ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}