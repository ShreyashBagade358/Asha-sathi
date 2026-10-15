import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { referralService, type ReferralFollowupAll } from '@/services/referral.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import type { FollowUpRecord, FollowUpStatus } from '@/pages/asha/mockData'

const STATUS_META: Record<FollowUpStatus, { label: string; className: string; icon: 'checkCircle' | 'calendar' | 'alert' }> = {
  scheduled: { label: 'Scheduled', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'calendar' },
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container', icon: 'alert' },
}

const STATUS_OPTIONS = ['recovered', 'improving', 'stable', 'worsened'] as const
const COMPLIANCE_OPTIONS = ['full', 'partial', 'none'] as const

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusOf(f: ReferralFollowupAll, today: string): FollowUpStatus {
  // Conducted follow-ups (or a completed referral) are done; a NULL due date is
  // a promise with no date attached, which is never overdue.
  const conducted = Boolean(f.treatmentCompliance || f.beneficiaryStatus) || f.referralStatus === 'completed'
  const due = f.followupDate ?? ''
  if (conducted) return 'completed'
  if (due !== '' && due < today) return 'overdue'
  return 'scheduled'
}

function toRecord(f: ReferralFollowupAll, patientName: string, today: string): FollowUpRecord & { referralId: string } {
  return {
    id: f.id,
    referralId: f.referralId,
    patientName,
    type: f.reason.trim() || '—',
    due: formatDate(f.followupDate),
    status: statusOf(f, today),
    notes: f.notes ?? f.beneficiaryStatus ?? undefined,
  }
}

export default function FollowUpAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | FollowUpStatus>('all')
  const [recording, setRecording] = useState<(FollowUpRecord & { referralId: string }) | null>(null)
  const [picking, setPicking] = useState(false)
  const [fuDate, setFuDate] = useState(new Date().toISOString().slice(0, 10))
  const [fuStatus, setFuStatus] = useState('')
  const [fuCompliance, setFuCompliance] = useState('')
  const [fuNotes, setFuNotes] = useState('')

  // One flat call (no per-referral N+1); the backend scopes it for ASHAs.
  const followUpsQuery = useQuery({
    queryKey: ['referral-followups'],
    queryFn: async (): Promise<(FollowUpRecord & { referralId: string })[]> => {
      const today = new Date().toISOString().slice(0, 10)
      const [followups, beneficiaries] = await Promise.all([
        referralService.listAllFollowups(),
        beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
      ])
      const names = new Map(beneficiaries.items.map((b) => [b.id, b.name]))
      return followups.map((f) => toRecord(f, names.get(f.beneficiaryId) ?? '—', today))
    },
  })

  const recordFollowup = useMutation({
    mutationFn: () =>
      recording
        ? referralService.recordReferralFollowup(recording.referralId, {
            followupDate: fuDate,
            beneficiaryStatus: fuStatus || undefined,
            treatmentCompliance: fuCompliance || undefined,
            notes: fuNotes.trim() || undefined,
          })
        : Promise.resolve(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['referral-followups'] })
      addToast('success', t('asha.fuSaved'))
      setRecording(null)
      setFuStatus('')
      setFuCompliance('')
      setFuNotes('')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const openRecord = (fu: FollowUpRecord & { referralId: string }) => {
    setRecording(fu)
    setFuDate(new Date().toISOString().slice(0, 10))
    setFuStatus('')
    setFuCompliance('')
    setFuNotes('')
  }

  // Referral picker for the Add flow — fetched only when the picker opens.
  const referralsQuery = useQuery({
    queryKey: ['referrals', 'followup-picker'],
    queryFn: async () => {
      const [referrals, beneficiaries] = await Promise.all([
        referralService.listReferrals({ pageSize: 1000 }),
        beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
      ])
      const names = new Map(beneficiaries.items.map((b) => [b.id, b.name]))
      return referrals.items
        .filter((r) => r.status !== 'cancelled')
        .map((r) => ({ ...r, patientName: names.get(r.beneficiaryId) ?? '—' }))
    },
    enabled: picking,
  })

  const startForReferral = (referralId: string, patientName: string, reason: string) => {
    setPicking(false)
    openRecord({ id: `new-${referralId}`, referralId, patientName, type: reason || '—', due: '', status: 'scheduled', notes: undefined })
  }

  const followUps = followUpsQuery.data ?? []
  const visible = followUps.filter((f) => (filter === 'all' ? true : f.status === filter))

  const tabs: { key: 'all' | FollowUpStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: followUps.length },
    { key: 'scheduled', label: t('asha.fuScheduled'), count: followUps.filter((f) => f.status === 'scheduled').length },
    { key: 'completed', label: t('asha.fuCompleted'), count: followUps.filter((f) => f.status === 'completed').length },
    { key: 'overdue', label: t('asha.fuOverdue'), count: followUps.filter((f) => f.status === 'overdue').length },
  ]

  const selectCls =
    'h-touch-target w-full rounded-lg border border-outline bg-surface px-3 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
        >
          <Icon name="plus" size={18} />
          {t('asha.fuAdd')}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {followUpsQuery.isLoading ? (
          <LoadingState />
        ) : followUpsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(followUpsQuery.error)}
            onRetry={() => followUpsQuery.refetch()}
          />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-12 text-center font-body-md text-body-md text-on-surface-variant shadow-card">
            {t('common.noData')}
          </div>
        ) : (
          visible.map((fu) => {
            const meta = STATUS_META[fu.status]
            return (
              <div
                key={fu.id}
                className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        fu.status === 'overdue'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-primary-container text-on-primary-container'
                      }`}
                    >
                      <Icon name={meta.icon} size={22} />
                    </span>
                    <div>
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{fu.patientName}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{fu.type}</p>
                    </div>
                  </div>
                  <span className={`flex shrink-0 items-center rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                {fu.notes ? (
                  <p className="border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-2.5 font-caption text-caption text-on-surface-variant">
                    {fu.notes}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className={`font-caption text-caption ${fu.status === 'overdue' ? 'font-semibold text-error' : 'text-on-surface-variant'}`}>
                    <Icon name="calendar" size={14} className="mr-1 inline" />
                    Due: {fu.due}
                  </span>
                  {fu.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => openRecord(fu)}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-caption text-caption font-semibold text-on-primary transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
                    >
                      <Icon name="checkCircle" size={14} />
                      {t('asha.fuRecord')}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      {picking ? (
        <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-card">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                {t('asha.fuPickReferral')}
              </h3>
              <button
                type="button"
                onClick={() => setPicking(false)}
                aria-label={t('common.cancel')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <p className="mb-3 font-caption text-caption text-on-surface-variant">{t('asha.fuPickReferralHint')}</p>
            {referralsQuery.isLoading ? (
              <LoadingState />
            ) : referralsQuery.isError ? (
              <ErrorState message={getErrorMessage(referralsQuery.error)} onRetry={() => referralsQuery.refetch()} />
            ) : (referralsQuery.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline px-4 py-8 text-center">
                <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.fuNoReferrals')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/asha/referrals')}
                  className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant"
                >
                  {t('asha.modReferral')}
                </button>
              </div>
            ) : (
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {(referralsQuery.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => startForReferral(r.id, r.patientName, r.reason)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{r.patientName}</p>
                      <p className="truncate font-caption text-caption text-on-surface-variant">
                        {r.reason || '—'} · {r.status}
                      </p>
                    </div>
                    <Icon name="chevronRight" size={18} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {recording ? (
        <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-card">
            <h3 className="mb-1 font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.fuRecordTitle')}
            </h3>
            <p className="mb-4 font-caption text-caption text-on-surface-variant">
              {recording.patientName} · {recording.type}
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="fu_date">
                  {t('asha.fuDate')} *
                </label>
                <input
                  id="fu_date"
                  type="date"
                  value={fuDate}
                  onChange={(e) => setFuDate(e.target.value)}
                  className="h-touch-target w-full rounded-lg border border-outline bg-surface px-3 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="fu_status">
                  {t('asha.fuPatientStatus')}
                </label>
                <select id="fu_status" value={fuStatus} onChange={(e) => setFuStatus(e.target.value)} className={selectCls}>
                  <option value="">{t('common.select')}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`asha.fuStatus_${s}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="fu_compliance">
                  {t('asha.fuCompliance')}
                </label>
                <select id="fu_compliance" value={fuCompliance} onChange={(e) => setFuCompliance(e.target.value)} className={selectCls}>
                  <option value="">{t('common.select')}</option>
                  {COMPLIANCE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`asha.fuCompliance_${c}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="fu_notes">
                  {t('asha.fuNotes')}
                </label>
                <textarea
                  id="fu_notes"
                  rows={2}
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  className="min-h-[64px] resize-y rounded-lg border border-outline bg-surface p-3 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRecording(null)}
                className="rounded-full px-5 py-2 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={recordFollowup.isPending}
                onClick={() => recordFollowup.mutate()}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:opacity-60"
              >
                <Icon name="save" size={16} />
                {recordFollowup.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
