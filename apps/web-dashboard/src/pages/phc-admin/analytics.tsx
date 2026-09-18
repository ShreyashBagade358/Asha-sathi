import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { dashboardService } from '@/services/dashboard.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { pregnancyService } from '@/services/pregnancy.service'
import { ashaService } from '@/services/asha.service'
import { childService } from '@/services/child.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function monthKey(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en', { month: 'short', year: '2-digit' })
}

export default function AnalyticsDashboardPhcAdmin() {
  const kpis = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardService.getKPIs(),
  })
  const beneficiaries = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const pregnancies = useQuery({
    queryKey: ['pregnancies', 'all'],
    queryFn: () => pregnancyService.listPregnancies({ pageSize: 1000 }),
  })
  const ashas = useQuery({
    queryKey: ['ashas', 'all'],
    queryFn: () => ashaService.listASHAs({ pageSize: 1000 }),
  })
  const children = useQuery({
    queryKey: ['children', 'count'],
    queryFn: () => childService.listChildren({ pageSize: 1000 }),
  })

  const allLoading = kpis.isLoading || beneficiaries.isLoading || pregnancies.isLoading || ashas.isLoading || children.isLoading
  const firstError = kpis.error ?? beneficiaries.error ?? pregnancies.error ?? ashas.error ?? children.error
  const refetchAll = () => {
    kpis.refetch()
    beneficiaries.refetch()
    pregnancies.refetch()
    ashas.refetch()
    children.refetch()
  }

  const benItems = beneficiaries.data?.items ?? []
  const pregItems = pregnancies.data?.items ?? []
  const ashaItems = ashas.data?.items ?? []

  const villages = useMemo(() => Array.from(new Set(benItems.map((b) => b.village).filter(Boolean))), [benItems])

  const [villageFilter, setVillageFilter] = useState('')
  const [ashaFilter, setAshaFilter] = useState('')
  const [applied, setApplied] = useState({ village: '', asha: '' })

  const filteredBens = applied.village ? benItems.filter((b) => b.village === applied.village) : benItems
  const filteredAshas = applied.asha
    ? ashaItems.filter((a) => a.id === applied.asha || a.ashaId === applied.asha)
    : ashaItems

  const benMap = useMemo(() => new Map(benItems.map((b) => [b.id, b])), [benItems])

  const highRiskMothers = pregItems.filter((p) => p.hrpLevel === 'high' || (p.highRisk && p.hrpLevel !== 'medium')).length

  const trend = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const b of benItems) {
      const key = monthKey(b.createdAt)
      if (!key) continue
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    return [...buckets.entries()].sort(([a], [c]) => (a > c ? 1 : -1)).map(([label, value]) => ({ label, value }))
  }, [benItems])
  const maxTrend = Math.max(1, ...trend.map((t) => t.value))

  const villageBreakdown = useMemo(
    () =>
      villages
        .filter((v) => !applied.village || v === applied.village)
        .map((v) => {
          const vPatients = filteredBens.filter((b) => b.village === v)
          const vPregs = pregItems.filter((p) => benMap.get(p.beneficiaryId)?.village === v)
          const vHigh = vPregs.filter((p) => p.hrpLevel === 'high' || p.hrpLevel === 'medium').length
          const vAsha = ashaItems.find((w) => w.village === v)
          return { village: v, patients: vPatients.length, pregnancies: vPregs.length, highRisk: vHigh, asha: vAsha?.name ?? '—' }
        }),
    [villages, filteredBens, pregItems, benMap, ashaItems, applied.village],
  )

  if (allLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Loading analytics…" />
        </main>
      </div>
    )
  }

  if (firstError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <ErrorState message={getErrorMessage(firstError)} onRetry={refetchAll} />
        </main>
      </div>
    )
  }

  const selectCls =
    'w-full h-12 rounded-lg border border-outline-variant bg-surface px-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary appearance-none'

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">monitoring</span>
              Analytics Overview
            </h2>
            <p className="text-caption text-on-surface-variant">Performance and health metrics for this PHC.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          {villages.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col lg:flex-row gap-md lg:items-end">
              <div className="flex-1">
                <label className="block text-label-md text-on-surface-variant mb-1">Village</label>
                <div className="relative">
                  <select className={selectCls} value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}>
                    <option value="">All Villages ({villages.length})</option>
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
                  <select className={selectCls} value={ashaFilter} onChange={(e) => setAshaFilter(e.target.value)}>
                    <option value="">All Workers ({ashaItems.length})</option>
                    {ashaItems.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.village ? ` (${a.village})` : ''}</option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setApplied({ village: villageFilter, asha: ashaFilter })}
                className="lg:pt-0 px-lg py-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md rounded-lg border border-outline-variant transition-colors h-12"
              >
                Apply Filters
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden">
              <span className="p-sm bg-primary-container text-on-primary-container rounded-lg w-fit">
                <span className="material-symbols-outlined">how_to_reg</span>
              </span>
              <p className="text-label-md text-on-surface-variant">Total Registrations</p>
              <p className="text-headline-lg text-on-surface font-bold">{(kpis.data?.beneficiaryCount ?? benItems.length).toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden">
              <span className="p-sm bg-secondary-container text-on-secondary-container rounded-lg w-fit">
                <span className="material-symbols-outlined">vaccines</span>
              </span>
              <p className="text-label-md text-on-surface-variant">Vaccination Coverage</p>
              <p className="text-headline-lg text-on-surface font-bold">{kpis.data?.immunizationCoverage ?? 0}%</p>
            </div>
            <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-lg flex flex-col gap-sm border-l-4 border-l-error">
              <span className="p-sm bg-error-container text-on-error-container rounded-lg w-fit">
                <span className="material-symbols-outlined">pregnant_woman</span>
              </span>
              <p className="text-label-md text-on-surface-variant">High-Risk Mothers</p>
              <p className="text-headline-lg text-error font-bold">{highRiskMothers}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden">
              <span className="p-sm bg-tertiary-container text-on-tertiary-container rounded-lg w-fit">
                <span className="material-symbols-outlined">child_care</span>
              </span>
              <p className="text-label-md text-on-surface-variant">Children Registered</p>
              <p className="text-headline-lg text-on-surface font-bold">{(children.data?.total ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <section className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col">
              <h3 className="text-headline-md text-on-surface mb-5">Monthly Registration Trend</h3>
              {trend.length === 0 ? (
                <div className="flex-1">
                  <EmptyState title="No registrations yet" description="New beneficiary enrollments will appear here." icon="how_to_reg" />
                </div>
              ) : (
                <div className="flex-1 flex items-end justify-between gap-2 border-b border-outline-variant pt-2">
                  {trend.map((t) => (
                    <div key={t.label} className="flex flex-col items-center flex-1 gap-1.5">
                      <span className="text-[10px] font-semibold text-on-surface">{t.value}</span>
                      <div
                        className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors"
                        style={{ height: `${Math.max(8, (t.value / maxTrend) * 100)}%`, minHeight: 8 }}
                      />
                      <span className="text-[10px] text-on-surface-variant font-medium">{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col max-h-[320px]">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h3 className="text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">style</span>
                  Top ASHA Workers
                </h3>
              </div>
              <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3 custom-scrollbar">
                {filteredAshas.length === 0 ? (
                  <EmptyState title="No workers" icon="groups" />
                ) : (
                  [...filteredAshas]
                    .sort((a, b) => b.performanceScore - a.performanceScore)
                    .slice(0, 5)
                    .map((w) => (
                      <Link key={w.id} to={`/phc/ashas/${w.id}`} className="flex items-center gap-3 hover:bg-surface-container transition-colors rounded-lg p-1">
                        <span className="size-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[11px] font-bold shrink-0">
                          {w.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-label-sm font-semibold text-on-surface truncate">{w.name}</p>
                          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(100, w.performanceScore)}%` }} />
                          </div>
                        </div>
                        <span className="text-label-sm font-semibold text-on-surface">{w.performanceScore}</span>
                      </Link>
                    ))
                )}
              </div>
            </section>
          </div>

          {villageBreakdown.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                  Village Overview
                </h3>
                <span className="text-caption text-on-surface-variant">{villageBreakdown.length} villages</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container/50">
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Village</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">Patients</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">Pregnancies</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">High Risk</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">ASHA Worker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {villageBreakdown.map((v, i) => (
                      <tr key={v.village} className={`transition-colors hover:bg-surface-container/40 ${i < villageBreakdown.length - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container' : 'bg-surface'}`}>
                        <td className="px-5 py-3 text-label-sm font-semibold text-on-surface">{v.village}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-center">{v.patients}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-center">{v.pregnancies}</td>
                        <td className="px-5 py-3 text-center">
                          {v.highRisk > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                              <span className="size-1.5 rounded-full bg-error" />
                              {v.highRisk}
                            </span>
                          ) : (
                            <span className="text-label-sm text-on-surface-variant">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-label-sm text-on-surface">{v.asha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}