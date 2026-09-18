import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { MOCK_HOUSEHOLDS, type Household } from '@/pages/asha/mockData'

const statusConfig: Record<Household['status'], { label: string; chip: string; icon: IconName; accent: string }> = {
  'visit-due': { label: 'asha.visitDue', chip: 'bg-error-container text-on-error-container', icon: 'alert', accent: 'bg-error' },
  'follow-up': { label: 'asha.followUp', chip: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle', accent: 'bg-secondary' },
  scheduled: { label: 'asha.scheduled', chip: 'bg-surface-container text-on-surface-variant', icon: 'calendar', accent: 'bg-outline' },
}

export default function AssignedHouseholdsAshaSathi() {
  const { t } = useLocalization()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-outline bg-outline-variant/40 px-4 py-2">
        <span className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
          <Icon name="box" size={16} />
          {t('asha.offlineMode')}
        </span>
      </div>

      <PageHeader
        title={t('asha.assignedHouseholds')}
        subtitle={t('asha.householdsSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHouseholds') }]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {MOCK_HOUSEHOLDS.map((household) => {
          const status = statusConfig[household.status]
          return (
            <article
              key={household.id}
              className={`relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card ${
                household.status === 'scheduled' ? 'opacity-75 grayscale-[50%] lg:col-span-2' : ''
              }`}
            >
              <span className={`absolute bottom-0 left-0 top-0 w-2 ${status.accent}`} />
              <div className="flex flex-col gap-2 p-5 pl-8">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">{household.headName}</h3>
                    <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                      <Icon name="users" size={16} />
                      {t('asha.familySize', { count: household.familySize })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-caption text-caption font-bold ${status.chip}`}>
                    <Icon name={status.icon} size={14} />
                    {t(status.label)}
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-0.5 font-body-md text-body-md text-on-surface-variant">
                  <p>{t('asha.lastVisit', { days: household.lastVisitDays })}</p>
                  {household.note ? <p>{t('asha.priorityNote', { note: household.note })}</p> : null}
                  {household.nextVisit ? <p>{t('asha.nextVisit', { day: household.nextVisit })}</p> : null}
                </div>
              </div>
              <div className="p-5 pt-0 pl-8">
                {household.status === 'scheduled' ? (
                  <button
                    type="button"
                    disabled
                    className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-surface-container font-label-md text-label-md font-semibold text-on-surface-variant"
                  >
                    <Icon name="calendar" size={18} />
                    {t('asha.planned')}
                  </button>
                ) : (
                  <Link
                    to={`/asha/households/${household.id}/visit`}
                    className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                  >
                    <Icon name="activity" size={18} />
                    {t('asha.startVisit')}
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <button
        type="button"
        aria-label={t('asha.addHousehold')}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg transition-all hover:bg-on-primary-fixed-variant active:scale-95 lg:bottom-8"
      >
        <Icon name="plus" size={28} />
      </button>
    </div>
  )
}
