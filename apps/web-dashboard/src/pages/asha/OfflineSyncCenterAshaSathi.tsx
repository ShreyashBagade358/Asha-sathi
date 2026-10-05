import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { syncService } from '@/services/sync.service'

function formatSince(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function OfflineSyncCenterAshaSathi() {
  const { t } = useLocalization()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => syncService.getStatus(),
  })

  const counters = [
    { key: 'push', label: t('asha.pendingRecords'), value: data?.pendingPush ?? 0 },
    { key: 'pull', label: 'Rows waiting to pull', value: data?.pendingPull ?? 0 },
    { key: 'conflicts', label: 'Conflicts', value: data?.conflicts ?? 0 },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        title={t('asha.syncCenterTitle')}
        subtitle={t('asha.syncCenterSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('nav.ashaSync') }]}
      />

      {isLoading ? (
        <LoadingState label={t('asha.syncing')} />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <section>
            <div className="relative flex flex-col items-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-5 text-center shadow-card">
              <div className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-full bg-primary-fixed opacity-20" />
              <Icon name={data?.online ? 'refresh' : 'alert'} size={40} className="mb-2 text-primary" />
              <h3 className="font-display-lg text-display-lg font-bold text-on-surface">
                {(data?.pendingPush ?? 0) + (data?.pendingPull ?? 0)}
              </h3>
              <p className="font-body-lg text-body-lg font-medium text-on-surface-variant">{t('asha.pendingRecords')}</p>
              <p className="mt-1 font-caption text-caption text-outline">
                {t('asha.lastSyncedAt', { time: formatSince(data?.lastSyncAt ?? null) })}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {counters.map((c) => (
              <div
                key={c.key}
                className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card"
              >
                <span className="font-caption text-caption uppercase tracking-wide text-on-surface-variant">{c.label}</span>
                <span className="font-display-lg text-display-lg font-bold text-on-surface">{c.value}</span>
              </div>
            ))}
          </section>

          {data && data.pendingPush + data.pendingPull + data.conflicts === 0 ? (
            <EmptyState
              icon="cloud_done"
              title={t('asha.nothingToShow')}
              description="Everything is up to date. Records captured on this device appear here until they are pushed to the server."
            />
          ) : null}
        </>
      )}
    </div>
  )
}
