import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@/services/notification.service'
import type { NotificationType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const TYPE_META: Record<NotificationType, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  alert: { label: 'Alert', bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error', icon: 'warning' },
  sync: { label: 'Sync', bg: 'bg-primary-container', text: 'text-on-primary-container', dot: 'bg-primary', icon: 'sync' },
  system: { label: 'System', bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', icon: 'info' },
  incentive: { label: 'Incentive', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary', icon: 'rewards' },
}

function timeLabel(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function NotificationsDashboardPhcAdmin() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread' | 'alert' | 'system' | 'sync' | 'incentive'>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationService.listNotifications({
      status: filter === 'unread' ? 'unread' : 'all',
      pageSize: 50,
    }),
  })

  const notifications = data?.items ?? []

  const readMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const counts = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.read).length,
    alerts: notifications.filter((n) => n.type === 'alert').length,
    tasks: notifications.filter((n) => n.type === 'system').length,
  }

  const notifsList = notifications.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    return n.type === filter
  })

  return (
      <div className="flex flex-col gap-6">
        <div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Total</span>
              <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
            <div className="text-caption text-on-surface-variant mt-1">All notifications</div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Unread</span>
              <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.unread}</div>
            <div className="text-caption text-on-surface-variant mt-1">Needs review</div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Alerts</span>
              <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px] text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
            </div>
            <div className="text-display-lg text-error font-display-lg">{counts.alerts}</div>
            <div className="text-caption text-on-surface-variant mt-1">Urgent items</div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">System</span>
              <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px] text-blue-500">info</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.tasks}</div>
            <div className="text-caption text-on-surface-variant mt-1">Action items</div>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            { key: 'all' as const, label: 'All', count: counts.total },
            { key: 'unread' as const, label: 'Unread', count: counts.unread },
            { key: 'alert' as const, label: 'Alerts', count: counts.alerts },
            { key: 'system' as const, label: 'System', count: counts.tasks },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
                filter === tab.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          {isLoading ? (
            <LoadingState label="Loading notifications…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
          ) : notifsList.length === 0 ? (
            <EmptyState
              title="No notifications found"
              description="There are no notifications in this category."
              icon="notifications_off"
            />
          ) : (
            notifsList.map((notification, index) => {
              const meta = TYPE_META[notification.type] ?? TYPE_META.alert
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => { if (!notification.read) readMutation.mutate(notification.id) }}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-container ${
                    index < notifsList.length - 1 ? 'border-b border-outline-variant/40' : ''
                  } ${notification.read ? 'opacity-60' : 'bg-surface-container-low/40'}`}
                >
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.text}`}>
                    <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-label-md font-semibold text-on-surface">{notification.title}</span>
                      {!notification.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-0.5 block text-body-md text-on-surface-variant">{notification.message}</span>
                    <span className="mt-1 block text-caption text-outline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      {timeLabel(notification.createdAt)}
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

