import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHAButton, ASHACard, StatusChip, type StatusChipVariant } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage } from '@/components/common/ErrorState'
import { systemService, type SystemStatus } from '@/services/system.service'

type Health = 'healthy' | 'degraded' | 'down'

interface ServiceRow {
  id: string
  name: string
  version: string
  health: Health
  uptime: string
  detail: string
}

const HEALTH_STATUS: Record<Health, StatusChipVariant> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function buildRows(status: SystemStatus): ServiceRow[] {
  const uptime = formatUptime(status.api.uptime_seconds)
  const apiHealth: Health = status.api.status === 'ok' ? 'healthy' : 'down'
  const dbHealth: Health = status.database.status === 'ok' ? 'healthy' : 'down'
  const modelsHealth: Health =
    status.models.total === 0 ? 'down' : status.models.available === status.models.total ? 'healthy' : status.models.available > 0 ? 'degraded' : 'down'
  return [
    { id: 'api', name: 'asha-sathi-api', version: status.api.version, health: apiHealth, uptime, detail: `started ${new Date(status.api.started_at).toLocaleDateString()}` },
    { id: 'db', name: 'postgresql', version: '—', health: dbHealth, uptime: '—', detail: status.database.latency_ms != null ? `${status.database.latency_ms} ms` : '—' },
    { id: 'ml', name: 'asha-sathi-ml', version: '—', health: modelsHealth, uptime: '—', detail: `${status.models.available}/${status.models.total} models` },
  ]
}

export default function DeploymentPage() {
  const { t } = useLocalization()

  const statusQuery = useQuery({
    queryKey: ['system-status'],
    queryFn: () => systemService.getStatus(),
    refetchInterval: 30_000,
  })

  const rows = useMemo(() => (statusQuery.data ? buildRows(statusQuery.data) : []), [statusQuery.data])
  const healthyCount = useMemo(() => rows.filter((s) => s.health === 'healthy').length, [rows])
  const counts = statusQuery.data?.counts

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ASHAButton
          variant="outline"
          fullWidth={false}
          icon={<Icon name="refresh" size={16} />}
          onClick={() => statusQuery.refetch()}
          label={t('common.syncNow')}
        />
      </div>

      {statusQuery.isPending ? (
        <ASHACard title={t('nav.deployment')}>
          <p className="text-body-md text-on-surface-variant">{t('common.loading')}</p>
        </ASHACard>
      ) : statusQuery.isError ? (
        <ASHACard title={t('nav.deployment')}>
          <p className="text-body-md text-error">{getErrorMessage(statusQuery.error)}</p>
        </ASHACard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
            <StatTile label={t('super.health')} value={`${healthyCount}/${rows.length}`} tone={healthyCount === rows.length ? 'success' : 'warning'} />
            <StatTile label={t('super.version')} value={statusQuery.data.api.version} tone="info" />
            <StatTile label={t('super.uptime')} value={formatUptime(statusQuery.data.api.uptime_seconds)} tone="neutral" />
          </div>

          <ASHACard title={t('nav.deployment')}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    {[t('super.serviceName'), t('super.version'), t('super.health'), t('super.uptime'), t('common.details')].map((h, i) => (
                      <th key={h + i} className={`px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3">
                        <span className="font-mono text-body-md font-medium text-on-surface">{s.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-label-md">{s.version}</td>
                      <td className="px-4 py-3 text-right"><StatusChip status={HEALTH_STATUS[s.health]} label={t(`super.${s.health}`)} /></td>
                      <td className="px-4 py-3 text-right text-label-md">{s.uptime}</td>
                      <td className="px-4 py-3 text-right text-label-md">{s.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ASHACard>

          {counts ? (
            <ASHACard title={t('nav.deployment')}>
              <div className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
                <CountTile label={t('super.userCount')} value={counts.users} />
                <CountTile label={t('kpis.ashas')} value={counts.asha_workers} />
                <CountTile label={t('kpis.beneficiaries')} value={counts.beneficiaries} />
                <CountTile label={t('kpis.pregnancies')} value={counts.pregnancies} />
              </div>
            </ASHACard>
          ) : null}
        </>
      )}
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

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-outline-variant px-3 py-2.5">
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p className="text-[22px] font-bold text-on-surface">{value}</p>
    </div>
  )
}
