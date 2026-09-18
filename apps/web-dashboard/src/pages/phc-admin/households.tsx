import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { householdService } from '@/services/household.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

const PAGE_SIZE = 8

export default function HouseholdDirectoryPhcAdmin() {
  const [villageFilter, setVillageFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['households', page, search, villageFilter],
    queryFn: () => householdService.listHouseholds({
      search: search || undefined,
      villageId: villageFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => householdService.deleteHousehold(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] })
      addToast('success', 'Household deleted.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleDelete = (id: string, hhid: string) => {
    if (window.confirm(`Delete household #${hhid}? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const totalMembers = items.reduce((s, h) => s + h.memberCount, 0)
  const avgSize = items.length > 0 ? Math.round(totalMembers / items.length) : 0
  const highRisk = items.reduce((s, h) => s + h.pregnantWomen, 0)

  const resetFilters = () => {
    setVillageFilter('')
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
              <h2 className="text-headline-md text-on-surface">Household Directory</h2>
              <p className="text-caption text-on-surface-variant">{total} households · {totalMembers} total members</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span>Synced</span>
              <span className="text-outline mx-1">·</span>
              <span className="text-secondary font-semibold">Online</span>
            </div>
            <Link to="/phc/households/new" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors active:scale-[0.98]">
              <span className="material-symbols-outlined text-[18px]">group_add</span>
              <span className="hidden sm:inline">Register Household</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Households</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">house</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{total}</div>
              <div className="text-caption text-on-surface-variant mt-1">Avg {avgSize} members</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Members</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{totalMembers}</div>
              <div className="text-caption text-on-surface-variant mt-1">Across all villages</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Pregnant Women</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">pregnant_woman</span>
                </div>
              </div>
              <div className={`text-display-lg font-display-lg ${highRisk > 0 ? 'text-tertiary' : 'text-on-surface'}`}>{highRisk}</div>
              <div className="text-caption text-on-surface-variant mt-1">{highRisk > 0 ? 'Needs priority visits' : 'All clear'}</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Eligible Women</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">medical_services</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{items.reduce((s, h) => s + h.eligibleWomen, 0)}</div>
              <div className="text-caption text-on-surface-variant mt-1">Of reproductive age</div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
              <h3 className="text-headline-sm text-on-surface font-semibold">All Households</h3>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    className="w-full sm:w-56 h-9 pl-9 pr-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary"
                    placeholder="Search households..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={villageFilter}
                  onChange={(e) => { setVillageFilter(e.target.value); setPage(1) }}
                >
                  <option value="">All Villages</option>
                </select>
                {(search || villageFilter) && (
                  <button onClick={resetFilters} className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <LoadingState label="Loading households…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No households found"
                description="There are no households registered yet, or none match your filters."
                icon="house"
                action={
                  (search || villageFilter) ? (
                    <button onClick={resetFilters} className="mt-3 text-primary text-label-md hover:underline">Clear filters</button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant">
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium">HH ID</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium">Head of Family</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium">Village</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium text-center">Members</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium text-center">Eligible Women</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium text-center">Children {"<"}5</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium text-center">Pregnant</th>
                        <th className="px-4 py-2.5 text-label-md text-on-surface-variant font-medium text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50 last:border-b-0">
                      {items.map((h, idx) => (
                        <tr key={h.id} className={`hover:bg-surface-container-low transition-colors cursor-pointer h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                          <td className="px-4 py-2.5 text-label-md text-primary font-semibold">#{h.householdId}</td>
                          <td className="px-4 py-2.5 text-body-md text-on-surface font-medium hover:underline underline-offset-2">{h.headName || '—'}</td>
                          <td className="px-4 py-2.5 text-body-md text-on-surface-variant">{h.village || '—'}</td>
                          <td className="px-4 py-2.5 text-body-md text-on-surface text-center font-medium">{h.memberCount}</td>
                          <td className="px-4 py-2.5 text-body-md text-on-surface text-center">{h.eligibleWomen}</td>
                          <td className="px-4 py-2.5 text-body-md text-on-surface text-center">{h.childrenUnder5}</td>
                          <td className="px-4 py-2.5 text-center">
                            {h.pregnantWomen > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-caption font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> {h.pregnantWomen}
                              </span>
                            ) : (
                              <span className="text-caption text-on-surface-variant">0</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link to={`/phc/households/${h.id}`} className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors inline-flex" title="View">
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                              </Link>
                              <button
                                onClick={() => handleDelete(h.id, h.householdId)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/40 transition-colors inline-flex disabled:opacity-50"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t border-outline-variant bg-surface flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant pl-1">
                    Showing {items.length} of {total} households
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
