import { useEffect, useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { patientService, type PatientFollowUp } from '@/services/patient.service'
import type { IconName } from '@/components/common/Icons'

const TYPE_ICON: Record<string, IconName> = {
  referral: 'fileText',
  task: 'checkCircle',
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-tertiary-container text-on-tertiary-container' },
  pending: { label: 'Pending', className: 'bg-tertiary-container text-on-tertiary-container' },
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export default function PatientFollowUpsPage() {
  const { t } = useLocalization()
  const [followUps, setFollowUps] = useState<PatientFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'completed'>('all')

  useEffect(() => {
    void (async () => {
      try {
        setFollowUps(await patientService.listFollowUps())
      } catch {
        setFollowUps([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const withOverdue = followUps.map((f) => ({
    ...f,
    effectiveStatus: isOverdue(f.due_date) && f.status !== 'completed' ? 'overdue' : f.status,
  }))

  const visible = withOverdue.filter((f) => {
    if (filter === 'all') return true
    if (filter === 'upcoming') return f.effectiveStatus === 'scheduled' || f.effectiveStatus === 'pending'
    return f.effectiveStatus === filter
  })

  const tabs = [
    { key: 'all' as const, label: 'All', count: withOverdue.length },
    { key: 'upcoming' as const, label: 'Upcoming', count: withOverdue.filter((f) => f.effectiveStatus === 'scheduled' || f.effectiveStatus === 'pending').length },
    { key: 'overdue' as const, label: 'Overdue', count: withOverdue.filter((f) => f.effectiveStatus === 'overdue').length },
    { key: 'completed' as const, label: 'Completed', count: withOverdue.filter((f) => f.effectiveStatus === 'completed').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t('patient.followUpsTitle')} subtitle={t('patient.followUpsSubtitle')} />

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

      {loading ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          Loading follow-ups…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('patient.noFollowUps')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => {
            const meta = STATUS_META[item.effectiveStatus] ?? STATUS_META.pending
            return (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        item.effectiveStatus === 'overdue'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-primary-container text-on-primary-container'
                      }`}
                    >
                      <Icon name={TYPE_ICON[item.type] ?? 'checkCircle'} size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{item.title}</p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {item.type === 'referral' ? t('patient.followUpReferral') : t('patient.followUpTask')}
                        {item.due_date ? ` · ${t('patient.followUpDue')}: ${formatDate(item.due_date)}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                {item.detail ? (
                  <div className="border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                    <p className="font-body-md text-body-md text-on-surface">{item.detail}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
