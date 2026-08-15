import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { KPICard } from '@/components/charts/KPICard'
import { TrendChart } from '@/components/charts/TrendChart'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

export default function DashboardPage() {
  const { t } = useLocalization()

  const { data, isLoading } = useQuery({
    queryKey: ['state-dashboard'],
    queryFn: () => dashboardService.getStateDashboard(),
  })

  const kpis = useMemo(
    () => [
      { label: t('kpis.pregnancies'), value: data?.kpis.totalPregnancies ?? 0, change: 5.1, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="heart" size={22} /> },
      { label: t('kpis.immunizationCoverage'), value: `${data?.kpis.immunizationCoverage ?? 0}%`, change: 2.4, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="shield" size={22} /> },
      { label: t('kpis.institutionalDeliveries'), value: `${data?.kpis.institutionalDeliveryRate ?? 0}%`, change: 1.1, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="checkCircle" size={22} /> },
      { label: t('kpis.ncdPositive'), value: data?.kpis.ncdPositive ?? 0, change: -3.0, trend: 'down' as const, accent: 'secondary' as const, icon: <Icon name="activity" size={22} /> },
      { label: t('kpis.ashaCount'), value: data?.kpis.ashaCount ?? 0, hint: `${data?.kpis.beneficiaryCount ?? 0} ${t('kpis.beneficiaries')}`, accent: 'primary' as const, icon: <Icon name="users" size={22} /> },
      { label: t('kpis.homeVisits'), value: data?.kpis.homeVisits ?? 0, change: 9.8, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="activity" size={22} /> },
    ],
    [data, t],
  )

  const comparisonData = useMemo(
    () => (data?.districtComparison ?? []).map((row) => ({ label: row.phcName, ...row.values })),
    [data],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.dashboard')} subtitle={t('state.dashboardSubtitle')} />

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('charts.districtWise')}>
          <ComparisonChart
            data={comparisonData}
            xKey="label"
            series={[
              { key: 'anc4', name: 'ANC4+', color: '#006565' },
              { key: 'institutional', name: 'Institutional', color: '#156820' },
              { key: 'immunization', name: 'Immunization', color: '#ac3509' },
            ]}
            height={320}
          />
        </ASHACard>

        <ASHACard title={t('charts.coverage')}>
          <TrendChart data={data?.trend ?? []} height={320} />
        </ASHACard>
      </div>

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('state.focusAreas')}>
          <div className="space-y-3">
            {(data?.focusAreas ?? []).map((f) => (
              <div key={f.districtId} className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
                <div>
                  <p className="text-body-md font-semibold text-on-surface">{f.districtName}</p>
                  <p className="text-label-md text-on-surface-variant">{f.laggingIndicator}</p>
                </div>
                <StatusChip status={f.gapPct > 20 ? 'danger' : 'warning'} label={`${t('state.gapPct')} ${f.gapPct}`} />
              </div>
            ))}
          </div>
        </ASHACard>

        <ASHACard title={t('state.mapPlaceholder')}>
          <div className="relative flex h-72 items-center justify-center overflow-hidden rounded-md border border-outline-variant bg-surface-container-low">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(#00656533 1px, transparent 1px), linear-gradient(90deg, #00656533 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="relative text-center">
              <Icon name="mapPin" size={40} className="mx-auto text-primary" />
              <p className="mt-2 text-label-lg text-on-surface-variant">{t('state.mapPlaceholder')}</p>
              <p className="text-label-md text-on-surface-variant">{data?.kpis.villageCount ?? 0} {t('kpis.villages')}</p>
            </div>
          </div>
        </ASHACard>
      </div>
    </div>
  )
}
