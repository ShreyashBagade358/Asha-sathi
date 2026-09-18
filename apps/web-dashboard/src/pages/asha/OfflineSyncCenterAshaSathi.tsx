import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { SYNC_QUEUE, type SyncQueueItem } from '@/pages/asha/mockData'

type SyncState = 'stored' | 'syncing' | 'failed' | 'synced'

const stateStyles: Record<SyncState, { chip: string; icon: IconName; spin?: boolean }> = {
  stored: { chip: 'bg-surface-variant text-on-surface-variant', icon: 'box' },
  syncing: { chip: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', icon: 'refresh', spin: true },
  failed: { chip: 'bg-error text-on-error', icon: 'alert' },
  synced: { chip: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
}

type Tab = 'pending' | 'synced' | 'failed'

export default function OfflineSyncCenterAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const [queue, setQueue] = useState<SyncQueueItem[]>(SYNC_QUEUE)
  const [tab, setTab] = useState<Tab>('pending')
  const [lastSynced, setLastSynced] = useState('2 hours ago')

  const pendingCount = queue.filter((q) => q.state !== 'synced').length
  const failedCount = queue.filter((q) => q.state === 'failed').length
  const syncedCount = queue.filter((q) => q.state === 'synced').length

  const syncNow = () => {
    setQueue((prev) => prev.map((q) => (q.state === 'stored' ? { ...q, state: 'syncing' as const } : q)))
    setTimeout(() => {
      setQueue((prev) => prev.map((q) => (q.state === 'syncing' ? { ...q, state: 'synced' as const } : q)))
      setLastSynced('Just now')
      addToast('success', t('asha.syncCompleteToast'))
    }, 1500)
  }

  const retry = (id: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, state: 'stored' as const } : q)))
    setTab('pending')
  }

  const visible = queue.filter((q) => (tab === 'pending' ? q.state !== 'synced' : tab === 'failed' ? q.state === 'failed' : q.state === 'synced'))

  const tabs: { key: Tab; label: string; count: number; tone?: string }[] = [
    { key: 'pending', label: t('asha.pending'), count: pendingCount },
    { key: 'synced', label: t('asha.synced'), count: syncedCount },
    { key: 'failed', label: t('asha.failed'), count: failedCount, tone: failedCount ? 'text-error' : '' },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        title={t('asha.syncCenterTitle')}
        subtitle={t('asha.syncCenterSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaSync') }]}
      />

      <section>
        <div className="relative flex flex-col items-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-5 text-center shadow-card">
          <div className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-full bg-primary-fixed opacity-20" />
          <Icon name="box" size={40} className="mb-2 text-primary" />
          <h3 className="font-display-lg text-display-lg font-bold text-on-surface">{pendingCount}</h3>
          <p className="font-body-lg text-body-lg font-medium text-on-surface-variant">{t('asha.pendingRecords')}</p>
          <p className="mt-1 font-caption text-caption text-outline">{t('asha.lastSyncedAt', { time: lastSynced })}</p>
          <button
            type="button"
            onClick={syncNow}
            disabled={pendingCount === 0}
            className="mt-4 flex min-h-[48px] w-full max-w-sm items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant active:scale-95 disabled:opacity-60"
          >
            <Icon name="refresh" size={20} />
            {t('asha.syncNow')}
          </button>
        </div>
      </section>

      <div className="mb-1 flex border-b border-outline-variant">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative flex-1 border-b-2 pb-2 text-center font-label-md text-label-md font-semibold transition-colors ${
              tab === item.key ? `border-primary ${item.tone ?? 'text-primary'}` : 'text-on-surface-variant'
            }`}
          >
            {item.label} ({item.count})
            {item.key === 'failed' && failedCount > 0 ? (
              <span className="absolute right-2 top-0 h-2 w-2 rounded-full bg-error" />
            ) : null}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-12 text-center shadow-card">
            <Icon name="checkCircle" size={32} className="text-secondary" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.nothingToShow')}</p>
          </div>
        ) : (
          visible.map((item) => {
            const style = stateStyles[item.state]
            const isFailed = item.state === 'failed'
            return (
              <article
                key={item.id}
                className={`relative flex flex-col gap-2 overflow-hidden rounded-lg border p-4 shadow-card ${
                  isFailed ? 'border-error/30 bg-error-container' : item.state === 'syncing' ? 'border-tertiary/50 bg-surface-container-lowest' : 'border-outline-variant bg-surface-container-lowest'
                }`}
              >
                {item.state === 'syncing' ? <span className="absolute left-0 top-0 h-1 w-1/3 animate-pulse bg-tertiary" /> : null}
                <div className="flex items-start justify-between">
                  <div className="pr-4">
                    <h4 className={`font-body-lg text-body-lg font-semibold ${isFailed ? 'text-on-error-container' : 'text-on-surface'}`}>
                      {item.title}
                    </h4>
                    <p className={`mt-1 font-body-md text-body-md ${isFailed ? 'text-on-error-container opacity-80' : 'text-on-surface-variant'}`}>
                      {isFailed ? t('asha.networkTimeout') : t('asha.formLabel', { form: item.form })}
                    </p>
                  </div>
                  {item.state === 'syncing' ? (
                    <Icon name="refresh" size={20} className="mt-1 animate-spin text-tertiary" />
                  ) : null}
                  {isFailed ? <Icon name="alert" size={20} className="mt-1 text-error" /> : null}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 font-caption text-caption font-bold ${style.chip}`}>
                    <Icon name={style.icon} size={14} className={style.spin ? 'animate-spin' : ''} />
                    {item.state === 'stored'
                      ? t('asha.storedLocally')
                      : item.state === 'syncing'
                        ? t('asha.syncing')
                        : item.state === 'synced'
                          ? t('asha.synced')
                          : t('asha.failed')}
                  </span>
                  {isFailed ? (
                    <button
                      type="button"
                      onClick={() => retry(item.id)}
                      className="p-1 font-label-md text-label-md text-error underline transition-opacity active:opacity-70"
                    >
                      {t('asha.retry')}
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
