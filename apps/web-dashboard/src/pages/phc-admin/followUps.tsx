import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ecService, type EligibleCouple } from '@/services/ec.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function statusConfig(status: string) {
  const s = (status ?? 'active').toLowerCase()
  if (s === 'scheduled') return { label: 'Scheduled', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', icon: 'calendar_today', dot: 'bg-tertiary' }
  if (s === 'completed') return { label: 'Completed', bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'check_circle', dot: 'bg-secondary' }
  if (s === 'overdue') return { label: 'Overdue', bg: 'bg-error-container', text: 'text-on-error-container', icon: 'warning', dot: 'bg-error' }
  if (s === 'pregnant') return { label: 'Pregnant', bg: 'bg-primary-container', text: 'text-on-primary-container', icon: 'pregnant_woman', dot: 'bg-primary' }
  return { label: 'Active', bg: 'bg-primary-container', text: 'text-on-primary-container', icon: 'favorite', dot: 'bg-primary' }
}

function nameFor(id: string, map: Map<string, string>): string {
  if (!id) return '—'
  const name = map.get(id)
  if (name) return name
  return id.length > 12 ? `${id.slice(0, 12)}…` : id
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function FollowUpDirectoryPhcAdmin() {
  const [filter, setFilter] = useState<'all' | 'active' | 'pregnant'>('all')
  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecService.deleteEligibleCouple(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eligible-couples'] })
      addToast('success', 'Eligible couple record deleted.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const confirmDelete = (id: string) => {
    if (window.confirm('Delete this eligible couple record? This cannot be undone.')) {
      deleteMutation.mutate(id)
    }
  }

  const couplesQuery = useQuery({
    queryKey: ['eligible-couples', 'followups'],
    queryFn: () => ecService.listEligibleCouples({ pageSize: 100 }),
  })

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'followup-names'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const benefitiors = beneficiariesQuery.data?.items ?? []
  const nameMap = new Map(benefitiors.map((b) => [b.id, b.name]))

  const followUps = (couplesQuery.data?.items ?? []).filter((c) => {
    if (filter === 'all') return true
    const status = (c.status ?? 'active').toLowerCase()
    if (filter === 'pregnant') return status === 'pregnant'
    return status === 'active' || status === 'overdue' || status === 'scheduled' || status === 'completed'
  })

  const overdue = (couplesQuery.data?.items ?? []).filter((c) => (c.status ?? 'active').toLowerCase() === 'overdue').length
  const scheduled = (couplesQuery.data?.items ?? []).filter((c) => (c.status ?? 'active').toLowerCase() === 'scheduled').length
  const completed = (couplesQuery.data?.items ?? []).filter((c) => (c.status ?? 'active').toLowerCase() === 'completed').length
  const total = couplesQuery.data?.total ?? 0

  function husbandName(c: EligibleCouple): string {
    const map = new Map<string, { name: string; phone?: string }>()
    benefitiors.forEach((b) => map.set(b.id, { name: b.name, phone: b.phone }))
    const m = map.get(c.husbandId)
    return m?.name ?? nameFor(c.husbandId, nameMap)
  }

  function wifeName(c: EligibleCouple): string {
    const map = new Map<string, { name: string; phone?: string }>()
    benefitiors.forEach((b) => map.set(b.id, { name: b.name, phone: b.phone }))
    const m = map.get(c.wifeId)
    return m?.name ?? nameFor(c.wifeId, nameMap)
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
                <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
                Follow-ups
              </h2>
              <p className="text-caption text-on-surface-variant">{total} total · {overdue} overdue · {scheduled} scheduled</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Follow-ups</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">assignment</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{total}</div>
              <div className="text-caption text-on-surface-variant mt-1">All eligible couples</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Scheduled</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{scheduled}</div>
              <div className="text-caption text-on-surface-variant mt-1">Pending completion</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Completed</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{completed}</div>
              <div className="text-caption text-secondary mt-1">Closed tasks</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Overdue</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error">{overdue}</div>
              <div className="text-caption text-on-surface-variant mt-1">Needs attention</div>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {([
              { key: 'all' as const, label: 'All', count: total },
              { key: 'active' as const, label: 'Active', count: (couplesQuery.data?.items ?? []).filter((c) => (c.status ?? 'active').toLowerCase() !== 'pregnant' && (c.status ?? 'active').toLowerCase() !== 'completed').length },
              { key: 'pregnant' as const, label: 'Pregnant', count: (couplesQuery.data?.items ?? []).filter((c) => (c.status ?? 'active').toLowerCase() === 'pregnant').length },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
                  filter === tab.key
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {tab.label}
                <span className={`rounded-md px-1.5 text-[11px] font-bold leading-4 ${
                  filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {couplesQuery.isLoading ? (
              <LoadingState label="Loading follow-ups…" />
            ) : couplesQuery.isError ? (
              <ErrorState message={getErrorMessage(couplesQuery.error)} onRetry={couplesQuery.refetch} />
            ) : couplesQuery.data?.items.length === 0 ? (
              <EmptyState
                title="No eligible couples found"
                description="There are no eligible couples registered yet."
                icon="favorite"
              />
            ) : followUps.length === 0 ? (
              <EmptyState
                title="No follow-ups in this category"
                description="None match the selected filter."
                icon="task_alt"
              />
            ) : (
              followUps.map((fu, idx) => {
                const meta = statusConfig(fu.status)
                const isOverdue = (fu.status ?? 'active').toLowerCase() === 'overdue'
                const nextDue = fu.nextFollowupDate ? formatDate(fu.nextFollowupDate) : fu.lastFollowupDate ? `Last: ${formatDate(fu.lastFollowupDate)}` : '—'
                return (
                  <div
                    key={fu.id}
                    className={`bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow${isOverdue ? ' bg-red-50' : ''}`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 ${idx % 2 === 0 ? 'w-1' : 'w-0.5'} bg-error`}></div>

                    <div className="flex items-start justify-between gap-3 px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                          isOverdue ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-md font-medium text-on-surface truncate">{husbandName(fu)} & {wifeName(fu)}</p>
                          <p className="text-caption text-on-surface-variant truncate">
                            Reg. {formatDate(fu.registrationDate)} · {fu.currentMethod ? `Method: ${fu.currentMethod}` : '—'}
                          </p>
                        </div>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${meta.bg} ${meta.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                        {meta.label}
                      </span>
                    </div>

                    {fu.pregnancyConfirmed && (
                      <div className="border-t border-outline-variant/50 bg-surface-container-low/50 px-5 py-2.5">
                        <p className="text-caption text-on-surface-variant flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">pregnant_woman</span>
                          Pregnancy confirmed · last follow-up: {formatDate(fu.lastFollowupDate)}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant/50">
                      <span className="text-caption flex items-center gap-1 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {fu.nextFollowupDate ? `Next due: ${formatDate(fu.nextFollowupDate)}` : nextDue}
                      </span>
                      <button
                        onClick={() => confirmDelete(fu.id)}
                        disabled={deleteMutation.isPending}
                        className="flex shrink-0 items-center gap-1 border border-error text-error rounded-full px-2.5 py-1 text-caption font-semibold hover:bg-error-container/40 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}