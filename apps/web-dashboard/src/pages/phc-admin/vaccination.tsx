import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery } from '@tanstack/react-query'
import { vaccinationService } from '@/services/vaccination.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function initials(name: string) {
  return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function VaccinationManagementPhcAdmin() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 6

  const { data: coverage, isLoading: covLoading, isError: covError, error: covErrorObj, refetch: covRefetch } = useQuery({
    queryKey: ['vaccination-coverage'],
    queryFn: () => vaccinationService.getCoverage(),
  })

  const { data: due, isLoading: dueLoading, isError: dueError, error: dueErrorObj, refetch: dueRefetch } = useQuery({
    queryKey: ['vaccination-due', search],
    queryFn: () => vaccinationService.getDueVaccinations(),
  })

  const total = coverage?.totalChildren ?? 0
  const fully = coverage?.given ?? 0
  const pct = coverage?.coveragePct ?? 0
  const behind = coverage?.due ?? 0

  let dueListData = (due ?? []).filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      const name = d.childName ?? d.beneficiaryName ?? ''
      const vaccine = d.vaccineName ?? d.vaccineCode ?? ''
      return name.toLowerCase().includes(q) || vaccine.toLowerCase().includes(q)
    }
    return true
  })
  const filteredCount = dueListData.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize))
  const items = dueListData.slice((page - 1) * pageSize, page * pageSize)

  const resetFilters = () => {
    setSearch('')
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
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                Vaccination Management
              </h2>
              <p className="text-caption text-on-surface-variant">{total} children · {pct}% immunized</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
            <button className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors">
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
              <span className="hidden sm:inline">Send Reminders</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Children</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">child_care</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{total}</div>
              <div className="text-caption text-on-surface-variant mt-1">Registered children</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Doses Given</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{fully}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-surface-container-high rounded-full h-1.5">
                  <div className="bg-secondary h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                </div>
                <span className="text-caption text-secondary font-medium">{pct}%</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Immunization Due</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error">{behind}</div>
              <div className="text-caption text-on-surface-variant mt-1">Needs follow-up</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Low Stock Alerts</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">inventory</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">—</div>
              <div className="text-caption text-on-surface-variant mt-1">Inventory data not available</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-headline-sm text-on-surface font-semibold">Due & Overdue List</h3>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input
                      className="w-full sm:w-48 h-9 pl-9 pr-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary"
                      placeholder="Search children..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    />
                  </div>
                  {(search) && (
                    <button onClick={resetFilters} className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {dueLoading ? (
                <LoadingState label="Loading due vaccinations…" />
              ) : dueError ? (
                <div className="p-4"><ErrorState message={getErrorMessage(dueErrorObj)} onRetry={dueRefetch} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant">
                        <th className="p-3 px-4 text-label-md text-on-surface-variant font-medium">Child</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium">Due Vaccine</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium">Due Date</th>
                        <th className="p-3 text-label-md text-on-surface-variant font-medium text-right px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {items.map((d, idx) => (
                        <tr key={d.id} className={`hover:bg-gray-50 transition-colors h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                          <td className="p-3 px-4">
                            <Link to={`/phc/children/${d.childId}`} className="flex items-center gap-3 group">
                              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold shrink-0">
                                {initials(d.childName ?? d.beneficiaryName ?? '')}
                              </div>
                              <div>
                                <div className="text-body-md text-on-surface font-medium group-hover:text-primary transition-colors">{d.childName ?? d.beneficiaryName ?? '—'}</div>
                                <div className="text-caption text-on-surface-variant">{formatDate(d.dueDate)}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3">
                            <span className="text-body-md text-on-surface">{d.vaccineName}</span>
                            <span className="text-caption text-on-surface-variant block">Dose {d.doseNumber}</span>
                          </td>
                          <td className="p-3 text-body-md text-on-surface">{formatDate(d.dueDate)}</td>
                          <td className="p-3 px-4 text-right">
                            <button className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors inline-flex" title="Send reminder">
                              <span className="material-symbols-outlined text-[20px]">notifications</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center">
                            <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">check_circle</span>
                            <p className="text-body-lg text-on-surface-variant">All children are up to date on vaccinations.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 border-t border-outline-variant bg-surface flex justify-between items-center mt-auto">
                <span className="text-caption text-on-surface-variant pl-1">
                  {filteredCount} doses with pending vaccinations
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
            </div>

            <div className="bg-surface-container-lowest border-2 border-outline-variant rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface font-semibold">Coverage by Vaccine</h3>
              </div>
              {covLoading ? (
                <LoadingState label="Loading coverage…" />
              ) : covError ? (
                <ErrorState message={getErrorMessage(covErrorObj)} onRetry={covRefetch} />
              ) : (
                <div className="flex flex-col gap-4 flex-1">
                  {(coverage?.byVaccine ?? []).map((v) => {
                    const pct = coverage && coverage.totalImmunizations > 0 ? Math.round((v.given / coverage.totalImmunizations) * 100) : 0
                    const barColor = pct >= 80 ? 'bg-secondary' : pct >= 50 ? 'bg-tertiary' : 'bg-error'
                    return (
                      <div key={v.vaccineCode}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-label-md text-on-surface font-medium">{v.vaccineCode}</span>
                          <span className="text-caption text-on-surface-variant">{v.given} given</span>
                        </div>
                        <div className="w-full bg-surface-container-high rounded-full h-2">
                          <div className={`${barColor} h-2 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    )
                  })}
                  {(coverage?.byVaccine ?? []).length === 0 && (
                    <p className="text-body-md text-on-surface-variant text-center">No coverage data available.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-sm text-on-surface font-semibold mb-4">Vaccination Coverage</h3>
              {covLoading ? (
                <LoadingState label="Loading coverage…" />
              ) : covError ? (
                <ErrorState message={getErrorMessage(covErrorObj)} onRetry={covRefetch} />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-on-surface-variant">Total immunizations</span>
                    <span className="text-label-md text-on-surface font-semibold">{coverage?.totalImmunizations ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-on-surface-variant">Given</span>
                    <span className="text-label-md text-on-surface font-semibold">{coverage?.given ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-on-surface-variant">Due</span>
                    <span className="text-label-md text-on-surface font-semibold">{coverage?.due ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-on-surface-variant">Coverage</span>
                    <span className="text-label-md text-on-surface font-semibold">{coverage?.coveragePct ?? 0}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-sm text-on-surface font-semibold mb-4">Doses by Vaccine</h3>
              {covLoading ? (
                <LoadingState label="Loading coverage…" />
              ) : covError ? (
                <ErrorState message={getErrorMessage(covErrorObj)} onRetry={covRefetch} />
              ) : (
                <div className="flex flex-col gap-2">
                  {(coverage?.byVaccine ?? []).map((v) => {
                    const max = coverage?.byVaccine?.length ? Math.max(...coverage.byVaccine.map((x) => x.given), 1) : 1
                    const pct = Math.round((v.given / max) * 100)
                    const barColor = pct >= 80 ? 'bg-secondary' : pct >= 50 ? 'bg-tertiary' : 'bg-error'
                    return (
                      <div key={v.vaccineCode}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-label-md text-on-surface font-medium">{v.vaccineCode}</span>
                          <span className="text-caption text-on-surface-variant">{v.given} doses</span>
                        </div>
                        <div className="w-full bg-surface-container-high rounded-full h-2.5">
                          <div className={`${barColor} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    )
                  })}
                  {(coverage?.byVaccine ?? []).length === 0 && (
                    <p className="text-body-md text-on-surface-variant">No vaccination data available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
