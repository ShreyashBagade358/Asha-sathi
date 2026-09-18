import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'

type Filter = 'all' | 'pending' | 'done'

export default function TasksAshaSathi() {
  const { t } = useLocalization()
  const tasks = useAppStore((s) => s.tasks)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const [filter, setFilter] = useState<Filter>('pending')

  const pending = tasks.filter((x) => !x.done)

  const visible = tasks.filter((x) =>
    filter === 'all' ? true : filter === 'done' ? x.done : !x.done,
  )

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'pending', label: t('asha.filterPending'), count: pending.length },
    { key: 'done', label: t('asha.filterDone'), count: tasks.length - pending.length },
    { key: 'all', label: t('asha.filterAll'), count: tasks.length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.tasksTitle')}
        subtitle={t('asha.tasksSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaTasks') }]}
      />

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-14 text-center shadow-card">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high shadow-sm">
            <div className="absolute inset-0 animate-pulse rounded-full bg-secondary opacity-10" />
            <Icon name="checkCircle" size={40} className="text-secondary" />
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">{t('asha.noTasks')}</h2>
            <p className="mt-1 max-w-sm font-body-md text-body-md text-on-surface-variant">{t('asha.noTasksHint')}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {visible.map((task, index) => (
            <div
              key={task.id}
              className={`flex items-center justify-between gap-3 p-4 transition-colors ${
                index < visible.length - 1 ? 'border-b border-outline-variant/40' : ''
              } ${task.done ? 'bg-surface-container-low/60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.done ? t('asha.markPending') : t('asha.markDone')}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
                    task.done ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'
                  }`}
                >
                  <Icon name={task.done ? 'checkCircle' : 'check'} size={24} />
                </button>
                <div>
                  <p className={`font-label-md text-label-md font-semibold text-on-surface ${task.done ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant">{task.subtitle}</p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${
                  task.done
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {task.due}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="activity" size={20} />
          </span>
          <div>
            <p className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.upcomingTasks')}</p>
            <p className="font-caption text-caption text-on-surface-variant">{t('asha.upcomingHint')}</p>
          </div>
        </div>
        <Link
          to="/asha/home"
          className="flex items-center gap-1 font-label-md text-label-md font-semibold text-primary hover:underline"
        >
          {t('asha.viewAgenda')}
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </div>
  )
}
