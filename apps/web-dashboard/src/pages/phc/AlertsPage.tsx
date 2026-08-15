import { useMemo, useState } from 'react'
import { ASHAButton, ASHACard, StatusChip, type StatusChipVariant } from 'asha-design-system'
import { format } from 'date-fns'
import { useLocalization } from '@/hooks/useLocalization'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icons'
import type { AlertItem, AlertType } from '@/types'

const FALLBACK_ALERTS: AlertItem[] = [
  { id: 'a1', type: 'hrp', severity: 'critical', title: 'HRP escalation: Sunita Devi', message: 'BP 160/100 mmHg at 34 weeks. Immediate referral advised.', location: 'Rampur', createdAt: new Date(Date.now() - 2 * 36e5).toISOString(), status: 'open' },
  { id: 'a2', type: 'hrp', severity: 'high', title: 'HRP: Kamla Kumari', message: 'Severe anaemia (Hb 6.8 g/dL). Scheduled for transfusion review.', location: 'Sonpur', createdAt: new Date(Date.now() - 5 * 36e5).toISOString(), status: 'open' },
  { id: 'a3', type: 'stockout', severity: 'critical', title: 'Stockout: Inj. Oxytocin', message: 'Stock below minimum threshold (8/40 units).', location: 'PHC Store', createdAt: new Date(Date.now() - 8 * 36e5).toISOString(), status: 'open' },
  { id: 'a4', type: 'stockout', severity: 'medium', title: 'Low stock: ORS packets', message: 'Level at 25% of monthly consumption.', location: 'Kandwa', createdAt: new Date(Date.now() - 26 * 36e5).toISOString(), status: 'acknowledged' },
  { id: 'a5', type: 'sync', severity: 'high', title: 'Sync failure: Saroj Yadav', message: 'Device not synced for 3 days. 42 records pending upload.', location: 'Kandwa', createdAt: new Date(Date.now() - 30 * 36e5).toISOString(), status: 'open' },
  { id: 'a6', type: 'outbreak', severity: 'critical', title: 'Suspected dengue cluster', message: '4 fever cases in 48h reported from Ward 3.', location: 'Tikari', createdAt: new Date(Date.now() - 40 * 36e5).toISOString(), status: 'open' },
]

const CATEGORIES: Array<{ type: AlertType; labelKey: string; icon: 'alert' | 'box' | 'refresh' | 'activity' }> = [
  { type: 'hrp', labelKey: 'alerts.hrpEscalations', icon: 'alert' },
  { type: 'stockout', labelKey: 'alerts.stockouts', icon: 'box' },
  { type: 'sync', labelKey: 'alerts.syncFailures', icon: 'refresh' },
  { type: 'outbreak', labelKey: 'alerts.outbreak', icon: 'activity' },
]

const SEVERITY_STATUS: Record<AlertItem['severity'], StatusChipVariant> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
}

export default function AlertsPage() {
  const { t } = useLocalization()
  const [active, setActive] = useState<AlertType>('hrp')
  const [alerts, setAlerts] = useState<AlertItem[]>(FALLBACK_ALERTS)

  const filtered = useMemo(() => alerts.filter((a) => a.type === active), [alerts, active])

  const updateStatus = (id: string, status: AlertItem['status']) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
  }

  const openCount = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, count: alerts.filter((a) => a.type === c.type && a.status === 'open').length })),
    [alerts],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/phc/dashboard' }, { label: t('nav.alerts') }]}
      />

      <div className="flex flex-wrap gap-2">
        {openCount.map((cat) => (
          <button
            key={cat.type}
            type="button"
            onClick={() => setActive(cat.type)}
            className={`flex h-touch items-center gap-2 rounded-full px-5 text-label-lg font-semibold transition-colors ${
              active === cat.type
                ? 'bg-primary text-on-primary'
                : 'border border-outline bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <Icon name={cat.icon} size={16} />
            {t(cat.labelKey)}
            {cat.count > 0 ? (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-label-md font-bold ${active === cat.type ? 'bg-on-primary text-primary' : 'bg-error text-on-error'}`}>
                {cat.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <ASHACard>
          <EmptyState title={t('alerts.noAlerts')} icon={<Icon name="checkCircle" size={28} />} />
        </ASHACard>
      ) : (
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          {filtered.map((alert) => (
            <ASHACard key={alert.id} title={alert.title} subtitle={format(new Date(alert.createdAt), 'dd MMM yyyy, HH:mm')}>
              <div className="space-y-3">
                <p className="text-body-md text-on-surface-variant">{alert.message}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={SEVERITY_STATUS[alert.severity]} label={alert.severity} />
                  <StatusChip status={alert.status === 'open' ? 'warning' : alert.status === 'acknowledged' ? 'info' : 'success'} label={alert.status} />
                  {alert.location ? (
                    <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
                      <Icon name="mapPin" size={14} /> {alert.location}
                    </span>
                  ) : null}
                </div>
                {alert.status !== 'resolved' ? (
                  <div className="flex gap-2 pt-1">
                    <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="check" size={16} />} onClick={() => updateStatus(alert.id, 'acknowledged')} disabled={alert.status === 'acknowledged'} label={t('alerts.acknowledge')} />
                    <ASHAButton variant="primary" fullWidth={false} icon={<Icon name="checkCircle" size={16} />} onClick={() => updateStatus(alert.id, 'resolved')} label={t('alerts.resolve')} />
                  </div>
                ) : null}
              </div>
            </ASHACard>
          ))}
        </div>
      )}
    </div>
  )
}
