import { useMemo, useState } from 'react'
import { ASHAButton, ASHACard, StatusChip, type StatusChipVariant } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'

interface ServiceStatus {
  id: string
  name: string
  version: string
  health: 'healthy' | 'degraded' | 'down'
  uptime: string
  lastDeployed: string
  replicas: number
}

const SERVICES: ServiceStatus[] = [
  { id: 's1', name: 'asha-sathi-api', version: '1.4.2', health: 'healthy', uptime: '12d 04h', lastDeployed: '2 days ago', replicas: 3 },
  { id: 's2', name: 'asha-sathi-worker', version: '1.4.2', health: 'degraded', uptime: '12d 04h', lastDeployed: '2 days ago', replicas: 2 },
  { id: 's3', name: 'asha-sathi-web', version: '1.4.2', health: 'healthy', uptime: '5d 11h', lastDeployed: '5 days ago', replicas: 2 },
  { id: 's4', name: 'asha-sathi-ml', version: '0.9.0', health: 'down', uptime: '—', lastDeployed: '18 days ago', replicas: 0 },
  { id: 's5', name: 'postgres-primary', version: '15.7', health: 'healthy', uptime: '40d 02h', lastDeployed: '40 days ago', replicas: 1 },
  { id: 's6', name: 'supabase-realtime', version: '2.45', health: 'healthy', uptime: '40d 02h', lastDeployed: '40 days ago', replicas: 2 },
]

const HEALTH_STATUS: Record<ServiceStatus['health'], StatusChipVariant> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
}

export default function DeploymentPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const [services, setServices] = useState<ServiceStatus[]>(SERVICES)

  const healthyCount = useMemo(() => services.filter((s) => s.health === 'healthy').length, [services])

  const restart = (id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, health: 'healthy' as const, uptime: '0m' } : s)))
    addToast('success', `${id} ${t('super.restartService')}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.deployment')}
        subtitle={t('super.deploymentSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/super/users' }, { label: t('nav.deployment') }]}
        actions={
          <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="refresh" size={16} />} onClick={() => addToast('success', t('common.syncNow'))} label={t('common.syncNow')} />
        }
      />

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
        <StatTile label={t('super.health')} value={`${healthyCount}/${services.length}`} tone={healthyCount === services.length ? 'success' : 'warning'} />
        <StatTile label={t('super.version')} value="1.4.2" tone="info" />
        <StatTile label={t('super.lastDeployed')} value="2 days ago" tone="neutral" />
      </div>

      <ASHACard title={t('nav.deployment')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                {[t('super.serviceName'), t('super.version'), t('super.health'), t('super.uptime'), t('super.lastDeployed'), t('super.replicas'), t('common.actions')].map((h, i) => (
                  <th key={h + i} className={`px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">
                    <span className="font-mono text-body-md font-medium text-on-surface">{s.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-label-md">{s.version}</td>
                  <td className="px-4 py-3 text-right"><StatusChip status={HEALTH_STATUS[s.health]} label={s.health} /></td>
                  <td className="px-4 py-3 text-right text-label-md">{s.uptime}</td>
                  <td className="px-4 py-3 text-right text-label-md">{s.lastDeployed}</td>
                  <td className="px-4 py-3 text-right text-label-md">{s.replicas}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="refresh" size={15} />} onClick={() => restart(s.id)} label={t('super.restartService')} />
                      <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="fileText" size={15} />} onClick={() => addToast('info', `${s.name} logs`)} label={t('super.viewLogs')} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ASHACard>
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'info' | 'neutral' }) {
  const color = tone === 'success' ? 'text-tertiary' : tone === 'warning' ? 'text-secondary' : tone === 'info' ? 'text-primary' : 'text-on-surface'
  return (
    <ASHACard title={label}>
      <p className={`text-[28px] font-bold ${color}`}>{value}</p>
    </ASHACard>
  )
}
