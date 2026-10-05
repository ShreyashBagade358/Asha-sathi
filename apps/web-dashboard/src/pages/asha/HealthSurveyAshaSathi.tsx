import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useTodayTasks } from '@/hooks/useTodayTasks'
import { DailyPlanCard } from '@/components/asha/DailyPlanCard'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { formatDay } from '@/pages/asha/taskView'

export default function HealthSurveyAshaSathi() {
  const { t } = useLocalization()
  const { tasks, isLoading, isError, error, refetch } = useTodayTasks()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.healthSurveyTitle')}
        subtitle={t('asha.visitQueueSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('asha.healthSurveyTitle') }]}
      />

      <DailyPlanCard tasks={tasks} />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="assignment"
          title={t('asha.noVisitsPlanned')}
          description={t('asha.noVisitsPlannedHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={`flex items-center justify-between gap-3 p-4 transition-colors ${
                index < tasks.length - 1 ? 'border-b border-outline-variant/40' : ''
              } ${task.done ? 'bg-surface-container-low/60' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    task.done
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-primary-container text-on-primary-container'
                  }`}
                >
                  <Icon name={task.done ? 'checkCircle' : 'mapPin'} size={22} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-label-md text-label-md font-semibold text-on-surface ${task.done ? 'line-through opacity-60' : ''}`}>
                      {task.title}
                    </p>
                    {task.priority === 'high' && !task.done ? (
                      <span className="rounded-full bg-error-container px-2 py-0.5 font-caption text-[11px] font-semibold text-on-error-container">
                        {task.priority}
                      </span>
                    ) : null}
                    {task.carriedFrom && !task.done ? (
                      <span className="rounded-full bg-tertiary-container px-2 py-0.5 font-caption text-[11px] font-semibold text-on-tertiary-container">
                        {t('asha.carriedBadge')} {formatDay(task.carriedFrom)}
                      </span>
                    ) : null}
                  </div>
                  {task.householdLabel ? (
                    <p className="truncate font-caption text-caption text-on-surface-variant">{task.householdLabel}</p>
                  ) : null}
                  {task.subtitle ? (
                    <p className="truncate font-caption text-caption text-on-surface-variant">{task.subtitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0">
                {task.householdId && task.householdHhid && !task.done ? (
                  <Link
                    to={`/asha/households/${task.householdId}/visit`}
                    className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-label-md text-label-md font-semibold text-on-primary hover:opacity-90"
                  >
                    {t('asha.startVisit')}
                    <Icon name="chevronRight" size={14} />
                  </Link>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${
                      task.done
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    {task.done ? t('asha.filterDone') : formatDay(task.due)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
