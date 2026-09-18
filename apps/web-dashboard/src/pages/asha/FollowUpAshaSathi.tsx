import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { FollowUpStatus } from '@/pages/asha/mockData'

const STATUS_META: Record<FollowUpStatus, { label: string; className: string; icon: 'checkCircle' | 'calendar' | 'alert' }> = {
  scheduled: { label: 'Scheduled', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'calendar' },
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container', icon: 'alert' },
}

export default function FollowUpAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const followUps = useAppStore((s) => s.followUps)
  const markFollowUpDone = useAppStore((s) => s.markFollowUpDone)
  const [filter, setFilter] = useState<'all' | FollowUpStatus>('all')

  const visible = followUps.filter((f) => (filter === 'all' ? true : f.status === filter))

  const tabs: { key: 'all' | FollowUpStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: followUps.length },
    { key: 'scheduled', label: t('asha.fuScheduled'), count: followUps.filter((f) => f.status === 'scheduled').length },
    { key: 'completed', label: t('asha.fuCompleted'), count: followUps.filter((f) => f.status === 'completed').length },
    { key: 'overdue', label: t('asha.fuOverdue'), count: followUps.filter((f) => f.status === 'overdue').length },
  ]

  const handleMarkDone = (id: string) => {
    markFollowUpDone(id)
    addToast('success', t('asha.fuDoneToast'))
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.followUpTitle')}
        subtitle={t('asha.followUpSubtitle')}
        breadcrumbs={[{ label: t('asha.followUpTitle') }]}
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
        {visible.map((fu) => {
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
                    onClick={() => handleMarkDone(fu.id)}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
                  >
                    <Icon name="check" size={16} />
                    {t('asha.fuMarkDone')}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
