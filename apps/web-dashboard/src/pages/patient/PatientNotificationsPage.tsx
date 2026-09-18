import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { PatientNotifType } from '@/pages/patient/mockData'

const TYPE_META: Record<PatientNotifType, { label: string; className: string; icon: IconName }> = {
  appointment: { label: 'patient.notifAppointments', className: 'bg-primary-container text-on-primary-container', icon: 'calendar' },
  referral: { label: 'patient.notifReferrals', className: 'bg-error-container text-on-error-container', icon: 'activity' },
  health: { label: 'patient.notifHealth', className: 'bg-secondary-container text-on-secondary-container', icon: 'heart' },
  system: { label: 'patient.notifSystem', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'settings' },
}

export default function PatientNotificationsPage() {
  const { t } = useLocalization()
  const notifications = useAppStore((s) => s.patientNotifications)
  const markNotificationRead = useAppStore((s) => s.markNotificationRead)
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead)
  const [filter, setFilter] = useState<'all' | 'unread' | PatientNotifType>('all')

  const unreadCount = notifications.filter((n) => !n.read).length

  const visible = notifications.filter((n) =>
    filter === 'all'
      ? true
      : filter === 'unread'
        ? !n.read
        : n.type === filter,
  )

  const tabs: { key: 'all' | 'unread' | PatientNotifType; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: notifications.length },
    { key: 'unread', label: t('patient.notifUnread'), count: unreadCount },
    { key: 'appointment', label: t('patient.notifAppointments'), count: notifications.filter((n) => n.type === 'appointment').length },
    { key: 'referral', label: t('patient.notifReferrals'), count: notifications.filter((n) => n.type === 'referral').length },
  ]

  const markAllRead = () => markAllNotificationsRead('patient')
  const toggleRead = (id: string) => markNotificationRead('patient', id)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.notifTitle')}
        subtitle={t('patient.notifSubtitle')}
        breadcrumbs={[{ label: t('patient.notifTitle') }]}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
            >
              <Icon name="checkCircle" size={18} />
              {t('patient.notifMarkAll')}
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
            <p className="font-body-md text-body-md text-on-surface-variant">{t('patient.notifEmpty')}</p>
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
