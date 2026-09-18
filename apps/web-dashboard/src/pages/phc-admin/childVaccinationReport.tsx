import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { vaccinationService } from '@/services/vaccination.service'
import { childService } from '@/services/child.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChildHealthVaccinationReportPhcAdmin() {
  const coverage = useQuery({
    queryKey: ['vaccination', 'coverage'],
    queryFn: () => vaccinationService.getCoverage(),
  })
  const due = useQuery({
    queryKey: ['vaccination', 'due'],
    queryFn: () => vaccinationService.getDueVaccinations(),
  })
  const children = useQuery({
    queryKey: ['children', 'count'],
    queryFn: () => childService.listChildren({ pageSize: 1000 }),
  })

  const allLoading = coverage.isLoading || due.isLoading || children.isLoading
  const firstError = coverage.error ?? due.error ?? children.error
  const refetchAll = () => {
    coverage.refetch()
    due.refetch()
    children.refetch()
  }

  const cov = coverage.data
  const dueItems = due.data ?? []
  const totalChildren = children.data?.total ?? 0

  const byVaccine = cov?.byVaccine ?? []
  const maxGiven = Math.max(1, ...byVaccine.map((v) => v.given))

  if (allLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Loading vaccination report…" />
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
              <span className="material-symbols-outlined text-primary text-[20px]">vaccines</span>
              Child Health & Vaccination
            </h2>
            <p className="text-caption text-on-surface-variant">
              Last updated: {new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 size-24 bg-primary-container rounded-full opacity-20" />
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Total Children Registered</p>
              <p className="text-headline-lg text-on-surface font-bold">{totalChildren.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Vaccination Coverage</p>
              <p className="text-headline-lg text-on-surface font-bold">{cov?.coveragePct ?? 0}%</p>
              <div className="w-full bg-surface-container-high rounded-full h-2 mt-1">
                <div className="bg-secondary h-2 rounded-full transition-all" style={{ width: `${cov?.coveragePct ?? 0}%` }} />
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm border-l-4 border-l-error">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Doses Due</p>
              <p className="text-headline-lg text-error font-bold">{cov?.due ?? 0}</p>
              <p className="text-caption text-on-surface-variant">{cov?.totalImmunizations ?? 0} scheduled total</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-headline-md text-on-surface">Coverage by Vaccine</h3>
                <span className="text-caption text-on-surface-variant">Doses administered</span>
              </div>
              {byVaccine.length === 0 ? (
                <EmptyState title="No vaccination data yet" description="Coverage will appear here once immunizations are recorded." icon="vaccines" />
              ) : (
                <div className="space-y-3">
                  {byVaccine.map((v) => (
                    <div key={v.vaccineCode} className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-on-surface-variant w-16 shrink-0">{v.vaccineCode}</span>
                      <div className="flex-1 h-3 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500/80"
                          style={{ width: `${Math.max(4, (v.given / maxGiven) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-on-surface w-8 text-right">{v.given}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 className="text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">event_busy</span>
                  Due Vaccinations
                </h3>
                <span className="bg-error-container text-on-error-container text-caption px-2 py-0.5 rounded-full font-bold">
                  {dueItems.length} due
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2 custom-scrollbar">
                {dueItems.length === 0 ? (
                  <EmptyState title="No vaccinations due" description="All scheduled doses are up to date." icon="verified" />
                ) : (
                  dueItems.map((d) => (
                    <Link
                      key={d.id}
                      to={`/phc/children/${d.childId}/vaccination`}
                      className="border border-outline-variant rounded-lg p-3 bg-surface hover:bg-surface-container-high transition-colors flex justify-between items-center gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="text-body-md font-semibold text-on-surface truncate">
                          {d.childName ?? d.beneficiaryName ?? 'Child'}
                        </h4>
                        <p className="text-caption text-on-surface-variant">
                          {d.vaccineName} · Dose {d.doseNumber}
                        </p>
                        <p className="text-caption text-error">Due {formatDate(d.dueDate)}</p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant shrink-0">chevron_right</span>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}