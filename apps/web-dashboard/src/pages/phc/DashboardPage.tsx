import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ASHAButton, ASHACard, StatusChip } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { KPICard } from '@/components/charts/KPICard'
import { CoverageChart } from '@/components/charts/CoverageChart'
import { HeatmapChart } from '@/components/charts/HeatmapChart'
import { DataTable, type Column } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icons'
import type { HRPAlert, SyncRecord } from '@/types'
import { format } from 'date-fns'

const SERIES = [
  { key: 'anc4', name: 'ANC4+', color: '#006565' },
  { key: 'institutional', name: 'Institutional', color: '#156820' },
  { key: 'immunization', name: 'Immunization', color: '#ac3509' },
  { key: 'ncd', name: 'NCD', color: '#76d6d5' },
]

export default function DashboardPage() {
  const { t } = useLocalization()
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['phc-dashboard', user?.phcId ?? 'default'],
    queryFn: () => dashboardService.getPHCDashboard(user?.phcId ?? 'phc-demo'),
  })

  const kpiCards = useMemo(
    () => [
      { label: t('kpis.pregnancies'), value: data?.kpis.totalPregnancies ?? 0, change: 6.2, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="heart" size={22} /> },
      { label: t('kpis.anc4Coverage'), value: `${data?.kpis.anc4Coverage ?? 0}%`, change: 3.1, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="activity" size={22} /> },
      { label: t('kpis.institutionalDeliveries'), value: `${data?.kpis.institutionalDeliveryRate ?? 0}%`, change: 1.4, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="checkCircle" size={22} /> },
      { label: t('kpis.immunizationCoverage'), value: `${data?.kpis.immunizationCoverage ?? 0}%`, change: 2.8, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="shield" size={22} /> },
      { label: t('kpis.hrpActive'), value: data?.kpis.hrpActive ?? 0, change: -2.0, trend: 'down' as const, accent: 'secondary' as const, icon: <Icon name="alert" size={22} /> },
      { label: t('kpis.ncdScreened'), value: data?.kpis.ncdScreened ?? 0, change: 8.4, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="activity" size={22} /> },
    ],
    [data, t],
  )

  const hrpColumns: Column<HRPAlert>[] = useMemo(
    () => [
      { key: 'beneficiaryName', header: t('common.name'), render: (r) => <span className="font-medium text-on-surface">{r.beneficiaryName}</span> },
      { key: 'village', header: t('common.village') },
      { key: 'ashaName', header: 'ASHA' },
      { key: 'reason', header: t('state.details') },
      { key: 'hrpLevel', header: t('alerts.severity'), render: (r) => <StatusChip status={r.hrpLevel === 'high' ? 'danger' : 'warning'} label={r.hrpLevel} /> },
      { key: 'detectedAt', header: t('common.date'), render: (r) => format(new Date(r.detectedAt), 'dd MMM') },
    ],
    [t],
  )

  const syncColumns: Column<SyncRecord>[] = useMemo(
    () => [
      { key: 'ashaName', header: 'ASHA', render: (r) => <span className="font-medium text-on-surface">{r.ashaName}</span> },
      { key: 'deviceId', header: 'Device' },
      { key: 'recordsSynced', header: 'Records' },
      { key: 'status', header: t('common.status'), render: (r) => <StatusChip status={r.status === 'success' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'} label={r.status} /> },
      { key: 'syncedAt', header: t('phc.lastSync'), render: (r) => format(new Date(r.syncedAt), 'dd MMM, HH:mm') },
    ],
    [t],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={t('phc.dashboardSubtitle')}
        actions={
          <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="refresh" size={16} />} onClick={() => undefined} label={t('common.syncNow')} />
        }
      />

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {kpiCards.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('phc.coverageTrend')}>
          {data ? (
            <CoverageChart
              data={data.coverageTrend.map((point) => ({
                label: point.label,
                anc4: point.anc4,
                institutional: point.institutional,
                immunization: point.immunization,
                ncd: point.ncd,
              })) as any}
              series={SERIES}
            />
          ) : (
            <EmptyState title={t('common.noData')} />
          )}
        </ASHACard>

        <ASHACard title={t('phc.villageCoverage')}>
          {data ? (
            <HeatmapChart
              rows={data.villageCoverage.map((v) => v.village)}
              indicators={[
                { key: 'anc4', label: 'ANC4+' },
                { key: 'immunization', label: 'IMN' },
                { key: 'ncd', label: 'NCD' },
              ]}
              values={Object.fromEntries(
                data.villageCoverage.flatMap((v) => [
                  [`${v.village}|anc4`, v.anc4],
                  [`${v.village}|immunization`, v.immunization],
                  [`${v.village}|ncd`, v.ncd],
                ]),
              )}
            />
          ) : (
            <EmptyState title={t('common.noData')} />
          )}
        </ASHACard>
      </div>

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('phc.hrpAlertList')}>
          <DataTable columns={hrpColumns} data={data?.hrpAlerts ?? []} loading={isLoading} keyExtractor={(r) => r.id} />
          <div className="pt-3">
            <Link to="/phc/alerts" className="inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline">
              {t('alerts.title')}
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
        </ASHACard>

        <ASHACard title={t('phc.recentSyncs')}>
          <DataTable columns={syncColumns} data={data?.recentSyncs ?? []} loading={isLoading} keyExtractor={(r) => r.id} />
        </ASHACard>
      </div>
    </div>
  )
}
