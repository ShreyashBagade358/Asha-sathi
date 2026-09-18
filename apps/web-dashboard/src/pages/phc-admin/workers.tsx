import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { ashaService, type ASHAStatus } from '@/services/asha.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const PAGE_SIZE = 8

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function performanceColor(score: number) {
  if (score >= 80) return 'text-secondary'
  if (score >= 60) return 'text-tertiary'
  return 'text-error'
}

function performanceBg(score: number) {
  if (score >= 80) return 'bg-secondary-container text-on-secondary-container'
  if (score >= 60) return 'bg-tertiary-container text-on-tertiary-container'
  return 'bg-error-container text-on-error-container'
}

function statusChip(status: ASHAStatus) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-caption font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Active
      </span>
    )
  }
  if (status === 'on_leave') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-caption font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> On Leave
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-caption font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Inactive
    </span>
  )
}

export default function AshaWorkerDirectoryPhcAdmin() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [status, setStatus] = useState<'all' | ASHAStatus>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ashas', page, search, village, status],
    queryFn: () => ashaService.listASHAs({
      search: search || undefined,
      village: village || undefined,
      status: status === 'all' ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  })

  const workers = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const active = workers.filter((w) => w.status === 'active').length
  const avgScore = workers.length > 0 ? Math.round(workers.reduce((s, w) => s + w.performanceScore, 0) / workers.length) : 0

  const resetFilters = () => {
    setSearch('')
    setVillage('')
    setStatus('all')
    setPage(1)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface">ASHA Workers</h2>
              <p className="text-caption text-on-surface-variant">{total} registered · {active} active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
              <span className="text-outline mx-1">·</span>
              <span className="text-secondary font-semibold">Online</span>
            </div>
            <Link to="/phc/ashas/new" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">Add Worker</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col justify-between h-28">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Workers</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{total}</div>
              <div className="text-caption text-secondary mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                <span>{active} active</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Active Workers</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{active}</div>
              <div className="text-caption text-on-surface-variant mt-1">
                {total > 0 ? Math.round((active / total) * 100) : 0}% attendance
              </div>
            </div>

            <div className="bg-surface-container-low border border-tertiary-container rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Avg Performance</span>
                <div className="bg-surface-variant text-on-surface p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">trending_up</span>
                </div>
              </div>
              <div className={`text-display-lg font-display-lg ${performanceColor(avgScore)}`}>{avgScore}%</div>
              <div className="text-caption text-on-surface-variant mt-1">
                {avgScore >= 80 ? 'Excellent' : avgScore >= 60 ? 'Average' : 'Needs improvement'}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">On Leave</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">medical_services</span>
                </div>
              </div>
              <div className={`text-display-lg font-display-lg ${workers.filter((w) => w.status === 'on_leave').length > 0 ? 'text-tertiary' : 'text-on-surface'}`}>{workers.filter((w) => w.status === 'on_leave').length}</div>
              <div className="text-caption text-on-surface-variant mt-1">
                {workers.filter((w) => w.status === 'on_leave').length > 0 ? 'Needs coverage' : 'All active'}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-headline-sm text-on-surface font-semibold">Worker Directory</h3>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    className="w-full sm:w-56 h-9 pl-9 pr-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary"
                    placeholder="Search workers..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={village}
                  onChange={(e) => { setVillage(e.target.value); setPage(1) }}
                >
                  <option value="">All Villages</option>
                </select>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as 'all' | ASHAStatus); setPage(1) }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
                {(search || village || status !== 'all') && (
                  <button onClick={resetFilters} className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <LoadingState label="Loading workers…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
            ) : workers.length === 0 ? (
              <EmptyState
                title="No workers found"
                description="There are no ASHA workers registered yet, or none match your filters."
                icon="group_off"
                action={
                  (search || village || status !== 'all') ? (
                    <button onClick={resetFilters} className="mt-2 text-primary text-label-md hover:underline">Clear filters</button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant">
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium sticky left-0 bg-surface-container-low z-10">Name</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium">Village</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium">Phone</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium text-center">Households</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium text-center">Score</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium text-center">Status</th>
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {workers.map((w, idx) => (
                        <tr key={w.id} className={`hover:bg-surface-container-low transition-colors h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                          <td className="p-3 px-4 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? undefined : 'var(--sys-color-surface-container-low, #F3EDF7)' }}>
                            <Link to={`/phc/ashas/${w.id}`} className="flex items-center gap-3 group">
                              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold shrink-0">
                                {initials(w.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-body-md text-on-surface font-medium group-hover:text-primary transition-colors truncate">{w.name}</div>
                                <div className="text-caption text-on-surface-variant">{w.ashaId}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3 text-body-md text-on-surface">{w.village || '—'}</td>
                          <td className="p-3 text-body-md text-on-surface-variant font-mono text-sm">+91 {w.phone}</td>
                          <td className="p-3 text-body-md text-on-surface text-center font-medium">{w.assignedHouseholds}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-md font-bold ${performanceBg(w.performanceScore)}`}>
                              {w.performanceScore}%
                            </span>
                          </td>
                          <td className="p-3 text-center">{statusChip(w.status)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/phc/ashas/${w.id}`} className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors inline-flex">
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t border-outline-variant bg-surface flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant pl-1">
                    Showing {workers.length} of {total} workers
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded border border-outline-variant text-outline hover:bg-surface-container disabled:opacity-50 transition-colors"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    <span className="text-label-md text-on-surface-variant px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      className="p-1 rounded border border-outline-variant text-outline hover:bg-surface-container disabled:opacity-50 transition-colors"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
