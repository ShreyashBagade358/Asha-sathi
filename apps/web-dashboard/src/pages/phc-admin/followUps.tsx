import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ecService, type EligibleCouple } from '@/services/ec.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function statusConfig(c: EligibleCouple) {
  const s = (c.status ?? 'active').toLowerCase()
  const today = new Date().toISOString().slice(0, 10)
  if (s === 'pregnant') return { label: 'Pregnant', bg: 'bg-primary-container', text: 'text-on-primary-container', icon: 'pregnant_woman', dot: 'bg-primary' }
  if (s === 'active' && c.nextFollowupDate && c.nextFollowupDate < today)
    return { label: 'Overdue', bg: 'bg-error-container', text: 'text-on-error-container', icon: 'warning', dot: 'bg-error' }
  if (s === 'active' && c.nextFollowupDate)
    return { label: 'Scheduled', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', icon: 'calendar_today', dot: 'bg-tertiary' }
  if (c.lastFollowupDate && !c.nextFollowupDate)
    return { label: 'Completed', bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'check_circle', dot: 'bg-secondary' }
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
  const [confirmPregnancy, setConfirmPregnancy] = useState<EligibleCouple | null>(null)
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

  const followupMutation = useMutation({
    mutationFn: async (c: EligibleCouple) => {
      const today = new Date().toISOString().slice(0, 10)
      const next = new Date()
      next.setMonth(next.getMonth() + 3)
      await ecService.recordFollowup(c.id, { followupDate: today, methodUsed: c.currentMethod, counselingGiven: true })
      await ecService.updateEligibleCouple(c.id, { lastFollowupDate: today, nextFollowupDate: next.toISOString().slice(0, 10), status: 'active' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eligible-couples'] })
      addToast('success', 'Follow-up recorded. Next due in 3 months.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const pregnancyMutation = useMutation({
    mutationFn: (c: EligibleCouple) =>
      ecService.updateEligibleCouple(c.id, { pregnancyConfirmed: true, status: 'pregnant' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eligible-couples'] })
      addToast('success', 'Pregnancy confirmed. ASHA notified.')
      setConfirmPregnancy(null)
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
    queryFn: () => ecService.listEligibleCouples({ status: 'all', pageSize: 100 }),
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

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date().toISOString().slice(0, 7)
  const items = couplesQuery.data?.items ?? []
  const overdue = items.filter(
    (c) => (c.status ?? '').toLowerCase() === 'active' && c.nextFollowupDate && c.nextFollowupDate < today,
  ).length
  const scheduled = items.filter(
    (c) => (c.status ?? '').toLowerCase() === 'active' && c.nextFollowupDate && c.nextFollowupDate >= today,
  ).length
  const completed = items.filter((c) => c.lastFollowupDate?.startsWith(monthStart)).length
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
      <div className="flex flex-col gap-6">
        <div>
        </div>

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
              <span className={`rounded-md px-1.5 text-label-sm font-bold leading-4 ${
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
            followUps.map((fu) => {
              const meta = statusConfig(fu)
              const isOverdue = meta.label === 'Overdue'
              const isPregnant = (fu.status ?? '').toLowerCase() === 'pregnant'
              const nextDue = fu.nextFollowupDate ? formatDate(fu.nextFollowupDate) : fu.lastFollowupDate ? `Last: ${formatDate(fu.lastFollowupDate)}` : '—'
              return (
                <div
                  key={fu.id}
                  className={`relative bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow${isOverdue ? ' bg-red-50' : ''}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 ${isOverdue ? 'w-1 bg-error' : 'w-0.5 bg-primary/40'}`}></div>

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
                    <div className="flex shrink-0 items-center gap-2">
                      {!isOverdue && !isPregnant && (
                        <button
                          onClick={() => followupMutation.mutate(fu)}
                          disabled={followupMutation.isPending}
                          className="flex items-center gap-1 bg-primary text-on-primary rounded-full px-3 py-1 text-caption font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                          {followupMutation.isPending ? 'Saving…' : 'Mark Follow-up'}
                        </button>
                      )}
                      {!isPregnant && (
                        <button
                          onClick={() => setConfirmPregnancy(fu)}
                          className="flex items-center gap-1 border border-outline text-on-surface-variant rounded-full px-3 py-1 text-caption font-semibold hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">pregnant_woman</span>
                          Confirm Pregnancy
                        </button>
                      )}
                      <button
                        onClick={() => confirmDelete(fu.id)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1 border border-error text-error rounded-full px-2.5 py-1 text-caption font-semibold hover:bg-error-container/40 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {confirmPregnancy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmPregnancy(null)}>
            <div
              className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <span className="material-symbols-outlined text-[24px]">pregnant_woman</span>
              </div>
              <h3 className="text-headline-sm text-on-surface">Confirm Pregnancy?</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                {husbandName(confirmPregnancy)} & {wifeName(confirmPregnancy)} will be marked as pregnant. Their assigned ASHA
                will be notified to register ANC and schedule the first visit.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmPregnancy(null)}
                  className="rounded-lg border border-outline px-4 py-2.5 text-label-md font-semibold text-on-surface hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => pregnancyMutation.mutate(confirmPregnancy)}
                  disabled={pregnancyMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2.5 text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {pregnancyMutation.isPending ? 'Confirming…' : 'Yes, Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}

