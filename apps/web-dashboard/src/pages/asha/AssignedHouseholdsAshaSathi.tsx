import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { householdService } from '@/services/household.service'

const PAGE_SIZE = 50

export default function AssignedHouseholdsAshaSathi() {
  const { t } = useLocalization()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['households', 'asha-assigned', 1],
    queryFn: () => householdService.listHouseholds({ page: 1, pageSize: PAGE_SIZE }),
  })

  const households = data?.items ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title={t('asha.assignedHouseholds')}
        subtitle={t('asha.householdsSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('nav.ashaHouseholds') }]}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : households.length === 0 ? (
        <EmptyState
          icon="home"
          title={t('asha.noHouseholds')}
          description="Households you register will appear here, ready for a visit."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {households.map((household) => (
            <article
              key={household.id}
              className="relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card"
            >
              <span className="absolute bottom-0 left-0 top-0 w-2 bg-primary" />
              <div className="flex flex-col gap-2 p-5 pl-8">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                      {household.headName || household.householdId}
                    </h3>
                    <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                      <Icon name="mapPin" size={16} />
                      {household.village || '—'}
                    </p>
                  </div>
                  {household.pregnantWomen > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tertiary-container px-3 py-1 font-caption text-caption font-bold text-on-tertiary-container">
                      <Icon name="heart" size={14} />
                      {household.pregnantWomen}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-body-md text-body-md text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Icon name="users" size={16} />
                    {t('asha.familySize', { count: household.memberCount })}
                  </span>
                  {household.childrenUnder5 > 0 ? (
                    <span className="flex items-center gap-1">
                      <Icon name="users" size={16} />
                      {t('asha.childrenUnder5', { count: household.childrenUnder5 })}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="p-5 pt-0 pl-8">
                <Link
                  to={`/asha/households/${household.id}/visit`}
                  className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <Icon name="activity" size={18} />
                  {t('asha.startVisit')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

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
