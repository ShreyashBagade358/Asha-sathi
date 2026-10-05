import { Icon } from '@/components/common/Icons'
import { useLocalization } from '@/hooks/useLocalization'
import { DAILY_TASK_QUOTA, formatDay, type ViewTask } from '@/pages/asha/taskView'

export function DailyPlanCard({ tasks }: { tasks: ViewTask[] }) {
  const { t } = useLocalization()

  const done = tasks.filter((task) => task.done).length
  const carried = tasks.filter((task) => task.carriedFrom)
  const percent = Math.min(100, Math.round((done / DAILY_TASK_QUOTA) * 100))

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="calendar" size={20} />
          </span>
          <div>
            <p className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.todaysVisits')}</p>
            <p className="font-caption text-caption text-on-surface-variant">
              {t('asha.visitsDoneOf', { done, quota: DAILY_TASK_QUOTA })}
            </p>
          </div>
        </div>
        {carried.length > 0 ? (
          <span className="rounded-full bg-tertiary-container px-2.5 py-1 font-caption text-caption font-semibold text-on-tertiary-container">
            {t('asha.carriedOverCount', {
              count: carried.length,
              date: formatDay(carried[0]?.carriedFrom),
            })}
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-variant">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
