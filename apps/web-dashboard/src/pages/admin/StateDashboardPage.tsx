import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { dashboardService } from '@/services/dashboard.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { KPICard } from '@/components/charts/KPICard'
import { TrendChart } from '@/components/charts/TrendChart'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

export default function DashboardPage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const [statePick, setStatePick] = useState('')
  const effectiveStateId = user?.stateId || statePick

  const statesQuery = useQuery({
    queryKey: ['config', 'states'],
    queryFn: () => configService.getStates(),
    enabled: !user?.stateId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['state-dashboard', effectiveStateId],
    queryFn: () => dashboardService.getStateDashboard(effectiveStateId || undefined),
    enabled: Boolean(effectiveStateId),
  })

  const kpis = useMemo(
    () => [
      { label: t('kpis.pregnancies'), value: data?.kpis.totalPregnancies ?? 0, change: 5.1, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="heart" size={22} /> },
      { label: t('kpis.immunizationCoverage'), value: `${data?.kpis.immunizationCoverage ?? 0}%`, change: 2.4, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="shield" size={22} /> },
      { label: t('kpis.institutionalDeliveries'), value: `${data?.kpis.institutionalDeliveryRate ?? 0}%`, change: 1.1, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="checkCircle" size={22} /> },
      { label: t('kpis.ncdPositive'), value: data?.kpis.ncdPositive ?? 0, change: -3.0, trend: 'down' as const, accent: 'secondary' as const, icon: <Icon name="activity" size={22} /> },
      { label: t('kpis.ashas'), value: data?.kpis.ashaCount ?? 0, hint: `${data?.kpis.beneficiaryCount ?? 0} ${t('kpis.beneficiaries')}`, accent: 'primary' as const, icon: <Icon name="users" size={22} /> },
      { label: t('kpis.homeVisits'), value: data?.kpis.homeVisits ?? 0, change: 9.8, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="activity" size={22} /> },
    ],
    [data, t],
  )

  const comparisonData = useMemo(
    () => (data?.districtComparison ?? []).map((row) => ({ label: row.phcName, ...row.values })),
    [data],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  if (!effectiveStateId) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <h2 className="text-headline-sm text-on-surface mb-4">Select State</h2>
        <SearchableSelect
          id="sd_state"
          label="State *"
          options={(statesQuery.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          showCode
          value={statePick}
          onChange={setStatePick}
          placeholder="Select state"
          loading={statesQuery.isLoading}
          loadingLabel="Loading states…"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">

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
              { key: 'anc4', name: 'ANC4+', color: '#4F46E5' },
              { key: 'institutional', name: 'Institutional', color: '#10B981' },
              { key: 'immunization', name: 'Immunization', color: '#F59E0B' },
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
                  'linear-gradient(#4F46E533 1px, transparent 1px), linear-gradient(90deg, #4F46E533 1px, transparent 1px)',
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
