import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { notificationService } from '@/services/notification.service'
import type { Notification } from '@/types'
import type { NotificationType } from '@/pages/asha/mockData'

type PageNotifType = NotificationType | 'incentive'

const TYPE_META: Record<PageNotifType, { label: string; className: string; icon: IconName }> = {
  alert: { label: 'Alert', className: 'bg-error-container text-on-error-container', icon: 'alert' },
  task: { label: 'Task', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'activity' },
  system: { label: 'System', className: 'bg-secondary-container text-on-secondary-container', icon: 'settings' },
  sync: { label: 'Sync', className: 'bg-primary-container text-on-primary-container', icon: 'refresh' },
  incentive: { label: 'Incentive', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'barChart' },
}

interface PageNotification {
  id: string
  type: PageNotifType
  title: string
  message: string
  time: string
  read: boolean
}

function toPageNotification(n: Notification): PageNotification {
  let time = ''
  if (n.createdAt) {
    const parsed = new Date(n.createdAt)
    time = Number.isNaN(parsed.getTime())
      ? n.createdAt
      : parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return { id: n.id, type: n.type, title: n.title, message: n.message, time, read: n.read }
}

export default function NotificationsAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', 'asha'],
    queryFn: () => notificationService.listNotifications({ pageSize: 50 }),
  })

  const notifications = (data?.items ?? []).map(toPageNotification)
  const unread = notifications.filter((n) => !n.read)
  const unreadCount = unread.length

  const markMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const markAllMutation = useMutation({
    mutationFn: () => Promise.all(unread.map((n) => notificationService.markRead(n.id))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const visible = notifications.filter((n) =>
    filter === 'all'
      ? true
      : filter === 'unread'
        ? !n.read
        : n.type === filter,
  )

  const tabs: { key: 'all' | 'unread' | NotificationType; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: notifications.length },
    { key: 'unread', label: t('asha.notifUnread'), count: unreadCount },
    { key: 'alert', label: t('asha.notifAlerts'), count: notifications.filter((n) => n.type === 'alert').length },
    { key: 'task', label: t('asha.notifTasks'), count: notifications.filter((n) => n.type === 'task').length },
  ]

  const handleMarkAll = () => {
    if (!markAllMutation.isPending && unreadCount > 0) markAllMutation.mutate()
  }
  const toggleRead = (id: string, read: boolean) => {
    if (!read && !markMutation.isPending) markMutation.mutate(id)
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.notifTitle')}
        subtitle={t('asha.notifSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('asha.notifTitle') }]}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              className="flex items-center gap-2 rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
            >
              <Icon name="checkCircle" size={18} />
              {t('asha.notifMarkAll')}
            </button>
          ) : null
        }
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

      <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Icon name="bell" size={40} className="text-outline" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.notifEmpty')}</p>
          </div>
        ) : (
          visible.map((notification, index) => {
            const meta = TYPE_META[notification.type] ?? TYPE_META.system
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => toggleRead(notification.id, notification.read)}
                className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-container ${
                  index < visible.length - 1 ? 'border-b border-outline-variant/40' : ''
                } ${notification.read ? 'opacity-60' : 'bg-surface-container-low/40'}`}
              >
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                  <Icon name={meta.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">{notification.title}</span>
                    {!notification.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="mt-0.5 block font-body-md text-body-md text-on-surface-variant">{notification.message}</span>
                  <span className="mt-1 block font-caption text-caption text-outline">
                    <Icon name="calendar" size={13} className="mr-1 inline" />
                    {notification.time}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
