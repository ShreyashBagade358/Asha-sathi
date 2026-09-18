import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationService } from '@/services/notification.service'
import { useUIStore } from '@/stores/ui.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function AlertsNotificationsDashboardPhcAdmin() {
  const { addToast } = useUIStore()
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastAudience, setBroadcastAudience] = useState<'asha' | 'patient'>('asha')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', 'alerts'],
    queryFn: () => notificationService.listNotifications({ pageSize: 50 }),
  })

  const notifications = data?.items ?? []
  const alerts = notifications.filter((n) => n.type === 'alert')

  const counts = {
    total: alerts.length,
    high: alerts.filter((n) => !n.read).length,
    medium: alerts.filter((n) => n.type === 'system').length,
    open: alerts.filter((n) => !n.read).length,
  }

  const broadcast = async () => {
    if (!broadcastMessage.trim()) return
    try {
      await notificationService.createNotification({
        title: broadcastAudience === 'asha' ? 'PHC Bulletin' : 'PHC Notice',
        message: broadcastMessage.trim(),
      })
      setBroadcastMessage('')
      addToast('success', broadcastAudience === 'asha' ? 'Broadcast sent to ASHA workers' : 'Broadcast sent to patients')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send broadcast'
      addToast('error', msg)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                Alerts & Notifications
              </h2>
              <p className="text-caption text-on-surface-variant">{counts.total} alerts · {counts.open} unread · {counts.high} critical</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Alerts</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
              <div className="text-caption text-on-surface-variant mt-1">All alert notifications</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Unread</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error">{counts.high}</div>
              <div className="text-caption text-on-surface-variant mt-1">Critical priority</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Open Alerts</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.open}</div>
              <div className="text-caption text-on-surface-variant mt-1">Awaiting action</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">System Notices</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.medium}</div>
              <div className="text-caption text-on-surface-variant mt-1">Broadcast updates</div>
            </div>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
              <span className="material-symbols-outlined text-primary text-[20px]">campaign</span>
              <h3 className="text-headline-md font-semibold text-on-surface">Broadcast Notification</h3>
            </div>
            <div className="p-5 flex flex-col lg:flex-row gap-3">
              <div className="flex items-center gap-3">
                <span className="text-label-md text-on-surface-variant whitespace-nowrap">Send to</span>
                <div className="relative">
                  <select
                    className="h-12 rounded-lg border border-outline bg-surface px-4 pr-10 text-on-surface appearance-none transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={broadcastAudience}
                    onChange={(e) => setBroadcastAudience(e.target.value as 'asha' | 'patient')}
                  >
                    <option value="asha">ASHA Workers</option>
                    <option value="patient">Patients</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </span>
                </div>
              </div>
              <input
                className="flex-1 h-12 rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-outline"
                placeholder="Type a message to broadcast..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') broadcast() }}
              />
              <button
                onClick={broadcast}
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Publish
              </button>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <h3 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">report</span>
                Recent Alerts
              </h3>
            </div>

            {isLoading ? (
              <LoadingState label="Loading alerts…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
            ) : alerts.length === 0 ? (
              <EmptyState
                title="No alerts found"
                description="There are no alert notifications yet."
                icon="notifications_active"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant w-12"></th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Title</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Message</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Timestamp</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a, index) => {
                      const isHigh = !a.read
                      return (
                        <tr key={a.id} className={`transition-colors hover:bg-surface-container-low/40 ${index < alerts.length - 1 ? 'border-b border-outline-variant/40' : ''} ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                          <td className="px-5 py-4 text-center">
                            <span className={`material-symbols-outlined text-[20px] ${isHigh ? 'text-red-500' : 'text-amber-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                              {isHigh ? 'error' : 'warning'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-label-md font-semibold text-on-surface">{a.title}</p>
                            <p className="text-caption text-on-surface-variant">ID: {a.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-body-md text-on-surface">{a.message}</p>
                          </td>
                          <td className="px-5 py-4 text-body-md text-on-surface-variant whitespace-nowrap">{formatDate(a.createdAt)}</td>
                          <td className="px-5 py-4">
                            {a.read ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold bg-surface-container-high text-on-surface">
                                <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant"></span>
                                Read
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold bg-error-container text-on-error-container">
                                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                                Unread
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}