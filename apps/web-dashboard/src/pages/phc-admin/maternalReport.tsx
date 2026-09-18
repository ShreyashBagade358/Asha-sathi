import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { ashaService } from '@/services/asha.service'
import { dashboardService } from '@/services/dashboard.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MaternalHealthReportPhcAdmin() {
  const kpis = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardService.getKPIs(),
  })
  const pregnancies = useQuery({
    queryKey: ['pregnancies', 'all'],
    queryFn: () => pregnancyService.listPregnancies({ pageSize: 1000 }),
  })
  const beneficiaries = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const ashas = useQuery({
    queryKey: ['ashas', 'all'],
    queryFn: () => ashaService.listASHAs({ pageSize: 1000 }),
  })

  const allLoading = kpis.isLoading || pregnancies.isLoading || beneficiaries.isLoading || ashas.isLoading
  const firstError = kpis.error ?? pregnancies.error ?? beneficiaries.error ?? ashas.error
  const refetchAll = () => {
    kpis.refetch()
    pregnancies.refetch()
    beneficiaries.refetch()
    ashas.refetch()
  }

  const pregItems = pregnancies.data?.items ?? []
  const benMap = useMemo(
    () => new Map((beneficiaries.data?.items ?? []).map((b) => [b.id, b])),
    [beneficiaries.data],
  )
  const ashaItems = ashas.data?.items ?? []

  const ongoing = pregItems.filter((p) => p.status === 'active').length
  const highRisk = pregItems.filter((p) => p.hrpLevel === 'high' || (p.highRisk && p.hrpLevel !== 'medium')).length
  const ancCoverage = kpis.data?.anc4Coverage ?? 0

  const riskBuckets = useMemo(() => {
    const high = pregItems.filter((p) => p.hrpLevel === 'high').length
    const medium = pregItems.filter((p) => p.hrpLevel === 'medium').length
    const low = pregItems.length - high - medium
    return { high, medium, low }
  }, [pregItems])
  const riskPct = (n: number) => (pregItems.length > 0 ? Math.round((n / pregItems.length) * 100) : 0)

  const priorityRows = useMemo(() => {
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return [...pregItems]
      .sort((a, b) => (rank[a.hrpLevel ?? 'low'] ?? 2) - (rank[b.hrpLevel ?? 'low'] ?? 2))
      .map((p) => {
        const ben = benMap.get(p.beneficiaryId)
        const asha = ashaItems.find((w) => w.ashaId === (ben?.ashaId ?? '') || w.village === (ben?.village ?? ''))
        const level = p.hrpLevel ?? (p.highRisk ? 'medium' : 'low')
        return {
          pregnancy: p,
          name: ben?.name ?? 'Beneficiary',
          village: ben?.village ?? '—',
          level,
          asha: asha?.name ?? '—',
        }
      })
  }, [pregItems, benMap, ashaItems])

  const levelChip: Record<string, { label: string; cls: string }> = {
    high: { label: 'High Risk', cls: 'bg-error-container text-on-error-container' },
    medium: { label: 'Medium Risk', cls: 'bg-tertiary-container text-on-tertiary-container' },
    low: { label: 'Low Risk', cls: 'bg-secondary-container text-on-secondary-container' },
  }

  if (allLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Loading maternal report…" />
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

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">pregnant_woman</span>
              Maternal Health Report
            </h2>
            <p className="text-caption text-on-surface-variant">
              ANC tracking and pregnancy risk overview · Updated {new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
              <div className="flex justify-between items-start">
                <p className="text-label-md text-on-surface-variant">Ongoing Pregnancies</p>
                <span className="material-symbols-outlined text-primary bg-primary-container/20 p-2 rounded-full">pregnant_woman</span>
              </div>
              <p className="text-headline-lg text-on-surface font-bold">{ongoing}</p>
              <p className="text-caption text-on-surface-variant">{pregItems.length} registered total</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
              <div className="flex justify-between items-start">
                <p className="text-label-md text-on-surface-variant">ANC-4 Completion Rate</p>
                <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-full">task_alt</span>
              </div>
              <p className="text-headline-lg text-on-surface font-bold">{ancCoverage}%</p>
              <div className="w-full bg-surface-container-high rounded-full h-2">
                <div className="bg-secondary h-2 rounded-full transition-all" style={{ width: `${ancCoverage}%` }} />
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm border-l-4 border-l-error">
              <div className="flex justify-between items-start">
                <p className="text-label-md text-on-surface-variant">High-Risk Pregnancies</p>
                <span className="material-symbols-outlined text-error bg-error-container/50 p-2 rounded-full">warning</span>
              </div>
              <p className="text-headline-lg text-error font-bold">{highRisk}</p>
              <p className="text-caption text-error">Requires follow-up</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col">
              <h3 className="text-headline-md text-on-surface mb-md">Risk Factor Distribution</h3>
              {pregItems.length === 0 ? (
                <EmptyState title="No pregnancies recorded" description="Risk distribution will appear once pregnancies are registered." icon="pregnant_woman" />
              ) : (
                <div className="space-y-4 flex-1">
                  {[
                    { key: 'high' as const, label: 'High', color: 'bg-error', count: riskBuckets.high },
                    { key: 'medium' as const, label: 'Medium', color: 'bg-tertiary', count: riskBuckets.medium },
                    { key: 'low' as const, label: 'Low', color: 'bg-secondary', count: riskBuckets.low },
                  ].map((r) => (
                    <div key={r.key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                          <span className={`size-2.5 rounded-full ${r.color}`} />
                          {r.label}
                        </span>
                        <span className="text-label-sm text-on-surface font-semibold">
                          {r.count} · {riskPct(r.count)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.max(0, riskPct(r.count))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h3 className="text-headline-md text-on-surface">High-Priority Patients</h3>
              </div>
              {priorityRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No pregnancies recorded" description="Registered pregnancies will appear here." icon="pregnant_woman" />
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-label-md">
                        <th className="py-sm px-5">Patient</th>
                        <th className="py-sm px-5">Village</th>
                        <th className="py-sm px-5">EDD</th>
                        <th className="py-sm px-5">Risk</th>
                        <th className="py-sm px-5">Status</th>
                        <th className="py-sm px-5">ASHA</th>
                        <th className="py-sm px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-md text-on-surface">
                      {priorityRows.map((row) => {
                        const chip = levelChip[row.level] ?? levelChip.low
                        const p = row.pregnancy
                        return (
                          <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest transition-colors">
                            <td className="py-3 px-5 font-semibold">{row.name}</td>
                            <td className="py-3 px-5 text-on-surface-variant">{row.village}</td>
                            <td className="py-3 px-5">{formatDate(p.edd)}</td>
                            <td className="py-3 px-5">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>
                            </td>
                            <td className="py-3 px-5 text-on-surface-variant capitalize">{p.status}</td>
                            <td className="py-3 px-5">{row.asha}</td>
                            <td className="py-3 px-5 text-right">
                              <Link
                                to={`/phc/maternal/${p.id}`}
                                className="inline-flex items-center justify-center p-1.5 rounded-full text-primary hover:bg-surface-container"
                              >
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}