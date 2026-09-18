import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { NotificationType } from '@/pages/asha/mockData'

const TYPE_META: Record<NotificationType, { label: string; className: string; icon: IconName }> = {
  alert: { label: 'Alert', className: 'bg-error-container text-on-error-container', icon: 'alert' },
  task: { label: 'Task', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'activity' },
  system: { label: 'System', className: 'bg-secondary-container text-on-secondary-container', icon: 'settings' },
  sync: { label: 'Sync', className: 'bg-primary-container text-on-primary-container', icon: 'refresh' },
}

export default function NotificationsAshaSathi() {
  const { t } = useLocalization()
  const notifications = useAppStore((s) => s.notifications)
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead)
  const markRead = useAppStore((s) => s.markNotificationRead)
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all')

  const unreadCount = notifications.filter((n) => !n.read).length

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

  const handleMarkAll = () => markAllRead('asha')
  const toggleRead = (id: string) => markRead('asha', id)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.notifTitle')}
        subtitle={t('asha.notifSubtitle')}
        breadcrumbs={[{ label: t('asha.notifTitle') }]}
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
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Icon name="bell" size={40} className="text-outline" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.notifEmpty')}</p>
          </div>
        ) : (
          visible.map((notification, index) => {
            const meta = TYPE_META[notification.type]
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => toggleRead(notification.id)}
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
