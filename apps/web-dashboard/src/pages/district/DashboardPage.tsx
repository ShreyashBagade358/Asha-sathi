import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ASHACard, StatusChip } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { KPICard } from '@/components/charts/KPICard'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

export default function DashboardPage() {
  const { t } = useLocalization()
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['district-dashboard', user?.districtId ?? 'default'],
    queryFn: () => dashboardService.getDistrictDashboard(user?.districtId ?? 'dist-demo'),
  })

  const kpis = useMemo(
    () => [
      { label: t('kpis.pregnancies'), value: data?.kpis.totalPregnancies ?? 0, change: 5.4, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="heart" size={22} /> },
      { label: t('kpis.anc4Coverage'), value: `${data?.kpis.anc4Coverage ?? 0}%`, change: 3.2, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="activity" size={22} /> },
      { label: t('kpis.institutionalDeliveries'), value: `${data?.kpis.institutionalDeliveryRate ?? 0}%`, change: 1.8, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="checkCircle" size={22} /> },
      { label: t('kpis.ashaCount'), value: data?.kpis.ashaCount ?? 0, hint: `${data?.kpis.villageCount ?? 0} ${t('kpis.villages')}`, accent: 'primary' as const, icon: <Icon name="users" size={22} /> },
    ],
    [data, t],
  )

  const phcChartData = useMemo(
    () =>
      (data?.phcComparison ?? []).map((row) => ({
        label: row.phcName.replace('PHC ', ''),
        ...row.values,
      })),
    [data],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={t('district.dashboardSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/district/dashboard' }]}
      />

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('charts.phcComparison')}>
          {data ? (
            <ComparisonChart
              data={phcChartData}
              xKey="label"
              series={[
                { key: 'anc4', name: 'ANC4+', color: '#006565' },
                { key: 'institutional', name: 'Institutional', color: '#156820' },
                { key: 'immunization', name: 'Immunization', color: '#ac3509' },
              ]}
            />
          ) : null}
          <Link to="/district/phc-comparison" className="mt-3 inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline">
            {t('nav.phcComparison')}
            <Icon name="chevronRight" size={16} />
          </Link>
        </ASHACard>

        <ASHACard title={t('district.resourcesTitle')}>
          <div className="space-y-3">
            {(data?.resourceUtilization ?? []).map((r) => (
              <div key={r.phcId} className="rounded-md border border-outline-variant px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-body-md font-semibold text-on-surface">{r.phcName}</p>
                  <StatusChip status={r.staffFillRate >= 75 ? 'success' : r.staffFillRate >= 50 ? 'warning' : 'danger'} label={`${r.staffFillRate}%`} />
                </div>
                <div className="flex gap-4 text-label-md text-on-surface-variant">
                  <span>{t('district.staffFillRate')}: {r.staffFillRate}%</span>
                  <span>{t('district.vaccineStock')}: {r.vaccineStockPct}%</span>
                  <span>{t('district.equipmentUtil')}: {r.equipmentUtilization}%</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/district/resources" className="mt-3 inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline">
            {t('district.allocateResources')}
            <Icon name="chevronRight" size={16} />
          </Link>
        </ASHACard>
      </div>
    </div>
  )
}
