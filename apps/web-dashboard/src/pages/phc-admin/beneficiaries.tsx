import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function ageFromDob(dob: string): number {
  if (!dob) return 0
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return 0
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return Math.max(0, a)
}

export default function BeneficiaryDirectoryPhcAdmin() {
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['beneficiaries', page, search, village],
    queryFn: () => beneficiaryService.listBeneficiaries({
      search: search || undefined,
      village: village || undefined,
      page,
      pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => beneficiaryService.deleteBeneficiary(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beneficiaries'] })
      addToast('success', 'Beneficiary marked inactive.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? The record will be marked inactive.`)) {
      deleteMutation.mutate(id)
    }
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const villages = useMemo(() => Array.from(new Set(items.map((p) => p.village).filter(Boolean))), [items])

  const pregnantCount = items.filter((p) => p.isPregnant).length
  const withChildCount = items.filter((p) => p.hasChild).length

  const resetFilters = () => {
    setSearch('')
    setVillage('')
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
                <span className="material-symbols-outlined text-primary text-[20px]">person_celebrate</span>
                Beneficiary Management
              </h2>
              <p className="text-caption text-on-surface-variant">Overview and detailed records of all registered beneficiaries.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
            <Link to="/phc/beneficiaries/new" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors active:scale-[0.98]">
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span className="hidden sm:inline">Add Patient</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Beneficiaries</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{total.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-caption text-secondary mt-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                Registered
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Pregnant Women (ANC)</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">pregnant_woman</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-semibold">{pregnantCount.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-caption text-secondary mt-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Currently pregnant
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">With Children</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">child_care</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-bold">{withChildCount.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-caption text-tertiary mt-1">
                <span className="material-symbols-outlined text-[14px]">child_care</span>
                Beneficiaries with children
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-outline"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">All Status</span>
                <div className="bg-surface-container-high text-on-surface-variant p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-on-surface">{total}</div>
              <div className="text-caption text-on-surface-variant mt-1">Total records</div>
            </div>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-2.5 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                <input
                  className="w-full sm:w-72 h-11 pl-10 pr-4 bg-surface-container rounded-lg border border-outline-variant shadow-sm text-body-md text-on-surface placeholder:text-on-surface-variant transition-all focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="Search by Name, ID, or Village"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    className="h-11 px-4 pr-10 bg-surface-container rounded-lg border border-outline-variant text-body-md text-on-surface appearance-none transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={village}
                    onChange={(e) => { setVillage(e.target.value); setPage(1) }}
                  >
                    <option value="">Village</option>
                    {villages.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  </span>
                </div>
                {(search || village) && (
                  <button onClick={resetFilters} className="h-11 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <LoadingState label="Loading beneficiaries…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No beneficiaries found"
                description="There are no beneficiaries registered yet, or none match your filters."
                icon="person_off"
                action={
                  (search || village) ? (
                    <button onClick={resetFilters} className="mt-1 text-primary text-label-md font-semibold hover:underline">Clear filters</button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Name / ID</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Age / Gender</th>
                        <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Village</th>
                        <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Risk Level</th>
                        <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Registered</th>
                        <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, idx) => {
                        const age = ageFromDob(p.dob)
                        return (
                          <tr key={p.id} className={`transition-colors hover:bg-surface-container-low/40 ${idx < items.length - 1 ? 'border-b border-outline-variant/40' : ''} odd:bg-surface-container-low/30`}>
                            <td className="px-5 py-3.5">
                              <Link to={`/phc/beneficiaries/${p.id}`} className="flex items-center gap-3 group">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-label-md font-bold shrink-0 ${p.isPregnant ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'}`}>
                                  {initials(p.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-body-md text-on-surface font-medium group-hover:text-primary transition-colors truncate">{p.name}</div>
                                  <div className="text-caption text-on-surface-variant">{p.abhaId ?? `ID: ${p.id}`}</div>
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3.5 text-body-md text-on-surface whitespace-nowrap">{age > 0 ? `${age} / ` : ''}{p.gender?.charAt(0)?.toUpperCase() ?? '—'}</td>
                            <td className="px-5 py-3.5 text-body-md text-on-surface-variant">{p.village || '—'}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold bg-surface-container-high text-on-surface-variant">
                                <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                                —
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-body-md text-on-surface-variant whitespace-nowrap">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Link to={`/phc/beneficiaries/${p.id}`} className="inline-flex items-center justify-center w-9 h-9 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors" title="View">
                                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                </Link>
                                <button
                                  onClick={() => handleDelete(p.id, p.name)}
                                  disabled={deleteMutation.isPending}
                                  className="inline-flex items-center justify-center w-9 h-9 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/40 transition-colors disabled:opacity-50"
                                  title="Delete"
                                >
                                  <span className="material-symbols-outlined text-[20px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/50 px-5 py-3">
                  <span className="text-caption text-on-surface-variant">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setPage(i + 1)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-label-md transition-colors ${
                          page === i + 1 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
