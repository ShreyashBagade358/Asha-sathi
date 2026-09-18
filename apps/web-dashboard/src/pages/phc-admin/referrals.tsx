import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { referralService } from '@/services/referral.service'
import { useUIStore } from '@/stores/ui.store'
import type { ReferralStatus } from '@/pages/asha/mockData'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const PAGE_SIZE = 8

function formatDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function statusChip(status: ReferralStatus) {
  const map: Record<ReferralStatus, { bg: string; text: string; label: string; icon: string; sizeClass: string }> = {
    pending: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', label: 'Pending', icon: 'schedule', sizeClass: 'text-caption' },
    accepted: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', label: 'Accepted', icon: 'check_circle', sizeClass: 'text-caption' },
    completed: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Completed', icon: 'done_all', sizeClass: 'text-[11px]' },
    cancelled: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Cancelled', icon: 'cancel', sizeClass: 'text-caption' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${s.sizeClass} font-semibold ${s.bg} ${s.text}`}>
      <span className="material-symbols-outlined text-[12px]">{s.icon}</span> {s.label}
    </span>
  )
}

export default function ReferralDirectoryPhcAdmin() {
  const { addToast } = useUIStore()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['referrals', statusFilter, urgencyFilter, page],
    queryFn: () => referralService.listReferrals({
      status: statusFilter || undefined,
      referralType: urgencyFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  })

  const referrals = data?.items ?? []
  const filteredCount = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const counts = {
    total: filteredCount,
    emergency: 0,
    pending: 0,
    completed: 0,
  }

  const acceptMutation = useMutation({
    mutationFn: (id: string) => referralService.acceptReferral(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] })
      addToast('success', 'Referral accepted.')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => referralService.completeReferral(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] })
      addToast('success', 'Referral marked as completed.')
    },
  })

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('')
    setUrgencyFilter('')
    setPage(1)
  }

  const patientLabel = (id: string) => {
    const short = id.length > 10 ? `${id.slice(0, 8)}…` : id
    return id ? short : '—'
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
                <span className="material-symbols-outlined text-primary text-[20px]">medical_services</span>
                Referral Directory
              </h2>
              <p className="text-caption text-on-surface-variant">{counts.total} total · show all statuses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
            <Link to="/phc/referrals/new" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">New Referral</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between transition-shadow hover:shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Referrals</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
              <div className="text-caption text-on-surface-variant mt-1">All referrals in system</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden transition-shadow hover:shadow-sm">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Emergency Cases</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error">{counts.emergency}</div>
              <div className="text-caption text-on-surface-variant mt-1">Requires immediate action</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between transition-shadow hover:shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Pending Acceptance</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.pending}</div>
              <div className="text-caption text-on-surface-variant mt-1">Awaiting response</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between transition-shadow hover:shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Completed</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.completed}</div>
              <div className="text-caption text-secondary mt-1">Successfully closed</div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-headline-sm text-on-surface font-semibold">All Referrals</h3>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    className="w-full sm:w-52 h-9 pl-9 pr-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary"
                    placeholder="Search patient, facility..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={urgencyFilter}
                  onChange={(e) => { setUrgencyFilter(e.target.value); setPage(1) }}
                >
                  <option value="">All Priority</option>
                  <option value="emergency">Emergency</option>
                  <option value="urgent">Urgent</option>
                  <option value="routine">Routine</option>
                </select>
                {(search || statusFilter || urgencyFilter) && (
                  <button onClick={resetFilters} className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <LoadingState label="Loading referrals…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
            ) : referrals.length === 0 ? (
              <EmptyState
                title="No referrals found"
                description="There are no referrals yet, or none match your filters."
                icon="medical_services"
                action={
                  (statusFilter || urgencyFilter) ? (
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
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium">Patient</th>
                        <th className="px-5 py-4 text-label-md text-on-surface-variant font-medium">Referred From</th>
                        <th className="px-5 py-4 text-label-md text-on-surface-variant font-medium">Referred To</th>
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium">Reason</th>
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium">Date</th>
                        <th className="px-5 py-4 text-label-md text-on-surface-variant font-medium text-center">Status</th>
                        <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {referrals.map((r, idx) => (
                        <tr key={r.id} className={`hover:bg-surface-container-low transition-colors h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                          <td className="px-4 py-3">
                            <Link to={`/phc/referrals/${r.id}`} className="flex items-center gap-3 group">
                              <div className="relative shrink-0">
                                <div className={`w-9 h-9 rounded-full ${r.urgency === 'emergency' ? 'bg-error-container text-on-error-container' : r.urgency === 'urgent' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'} flex items-center justify-center text-label-md font-bold`}>
                                  {patientLabel(r.beneficiaryId).charAt(0).toUpperCase()}
                                </div>
                                <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full ${r.urgency === 'emergency' ? 'bg-error' : r.urgency === 'urgent' ? 'bg-tertiary' : 'bg-primary'}`}></div>
                              </div>
                              <div>
                                <div className="text-body-md text-on-surface font-medium">{r.beneficiaryId ? `Beneficiary ${patientLabel(r.beneficiaryId)}` : '—'}</div>
                                <div className="text-caption text-on-surface-variant">{r.urgency}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-body-md text-on-surface-variant">{r.fromFacility || '—'}</td>
                          <td className="px-4 py-3 text-body-md text-on-surface font-medium">{r.toFacility || '—'}</td>
                          <td className="px-5 py-4">
                            <span className="text-body-md text-on-surface-variant line-clamp-1 max-w-[180px]" title={r.reason}>{r.reason || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-body-md text-on-surface-variant">{formatDate(r.referredAt)}</td>
                          <td className="px-5 py-4 text-center">{statusChip(r.status)}</td>
                          <td className="px-4 py-3 text-right">
                            {r.status === 'pending' && (
                              <button
                                disabled={acceptMutation.isPending}
                                onClick={() => acceptMutation.mutate(r.id)}
                                className="bg-green-600 text-white font-label-md text-label-md px-3 py-1 rounded-full hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                              >
                                Accept
                              </button>
                            )}
                            {r.status === 'accepted' && (
                              <button
                                disabled={completeMutation.isPending}
                                onClick={() => completeMutation.mutate(r.id)}
                                className="bg-secondary text-on-secondary font-label-md text-label-md px-3 py-1 rounded-full hover:bg-on-secondary-fixed-variant transition-colors font-medium disabled:opacity-50"
                              >
                                Complete
                              </button>
                            )}
                            {r.status === 'completed' && (
                              <span className="text-caption text-on-surface-variant">Closed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t border-outline-variant bg-surface flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant pl-1">
                    Showing {referrals.length} of {filteredCount} referrals
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