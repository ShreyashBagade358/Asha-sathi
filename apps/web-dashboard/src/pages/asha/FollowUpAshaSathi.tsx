import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { referralService } from '@/services/referral.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { api } from '@/lib/api'
import type { Referral } from '@/types'
import type { FollowUpRecord, FollowUpStatus } from '@/pages/asha/mockData'

const STATUS_META: Record<FollowUpStatus, { label: string; className: string; icon: 'checkCircle' | 'calendar' | 'alert' }> = {
  scheduled: { label: 'Scheduled', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'calendar' },
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container', icon: 'alert' },
}

interface RawFollowup {
  id: string
  referral_id: string
  followup_date?: string | null
  beneficiary_status?: string | null
  treatment_compliance?: string | null
  notes?: string | null
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toFollowUpRecord(f: RawFollowup, referral: Referral, patientName: string): FollowUpRecord {
  const due = f.followup_date ?? ''
  const scheduled = due !== '' && new Date(due).getTime() > Date.now()
  return {
    id: f.id,
    patientName,
    type: referral.reason.trim() || '—',
    due: formatDate(due),
    status: scheduled ? 'scheduled' : 'completed',
    notes: f.notes ?? f.beneficiary_status ?? undefined,
  }
}

export default function FollowUpAshaSathi() {
  const { t } = useLocalization()
  const [filter, setFilter] = useState<'all' | FollowUpStatus>('all')

  const followUpsQuery = useQuery({
    queryKey: ['referral-followups'],
    queryFn: async (): Promise<FollowUpRecord[]> => {
      const [referrals, beneficiaries] = await Promise.all([
        referralService.listReferrals({ pageSize: 1000 }),
        beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
      ])
      const names = new Map(beneficiaries.items.map((b) => [b.id, b.name]))
      const lists = await Promise.all(
        referrals.items.map(async (referral) => {
          const { data } = await api.get<RawFollowup[]>(`/referrals/${referral.id}/followups`)
          return data.map((f) => toFollowUpRecord(f, referral, names.get(referral.beneficiaryId) ?? '—'))
        }),
      )
      return lists.flat()
    },
  })

  const followUps = followUpsQuery.data ?? []

  const visible = followUps.filter((f) => (filter === 'all' ? true : f.status === filter))

  const tabs: { key: 'all' | FollowUpStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: followUps.length },
    { key: 'scheduled', label: t('asha.fuScheduled'), count: followUps.filter((f) => f.status === 'scheduled').length },
    { key: 'completed', label: t('asha.fuCompleted'), count: followUps.filter((f) => f.status === 'completed').length },
    { key: 'overdue', label: t('asha.fuOverdue'), count: followUps.filter((f) => f.status === 'overdue').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.followUpTitle')}
        subtitle={t('asha.followUpSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('asha.followUpTitle') }]}
      />

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
              className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${
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
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
