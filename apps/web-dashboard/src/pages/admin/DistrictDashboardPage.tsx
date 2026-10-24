import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ASHACard, StatusChip } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { KPICard } from '@/components/charts/KPICard'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

export default function DashboardPage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const [statePick, setStatePick] = useState('')
  const [districtPick, setDistrictPick] = useState('')
  const effectiveStateId = user?.stateId || statePick
  const effectiveDistrictId = user?.districtId || districtPick

  const statesQuery = useQuery({
    queryKey: ['config', 'states'],
    queryFn: () => configService.getStates(),
    enabled: !user?.districtId && !user?.stateId,
  })
  const districtsQuery = useQuery({
    queryKey: ['config', 'districts', effectiveStateId],
    queryFn: () => configService.getDistricts(effectiveStateId!),
    enabled: !user?.districtId && Boolean(effectiveStateId),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['district-dashboard', effectiveDistrictId ?? 'default'],
    queryFn: async () => {
      console.log('[DistrictDashboard] user.districtId:', user?.districtId);
      console.log('[DistrictDashboard] districtPick (from dropdown):', districtPick);
      console.log('[DistrictDashboard] effectiveDistrictId:', effectiveDistrictId);
      const result = await dashboardService.getDistrictDashboard(effectiveDistrictId || undefined);
      console.log('[DistrictDashboard] API Response:', result);
      return result;
    },
    enabled: Boolean(effectiveDistrictId),
  })

  const kpis = useMemo(
    () => [
      { label: t('kpis.pregnancies'), value: data?.kpis.totalPregnancies ?? 0, change: 5.4, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="heart" size={22} /> },
      { label: t('kpis.anc4Coverage'), value: `${data?.kpis.anc4Coverage ?? 0}%`, change: 3.2, trend: 'up' as const, accent: 'primary' as const, icon: <Icon name="activity" size={22} /> },
      { label: t('kpis.institutionalDeliveries'), value: `${data?.kpis.institutionalDeliveryRate ?? 0}%`, change: 1.8, trend: 'up' as const, accent: 'tertiary' as const, icon: <Icon name="checkCircle" size={22} /> },
      { label: t('kpis.ashas'), value: data?.kpis.ashaCount ?? 0, hint: `${data?.kpis.villageCount ?? 0} ${t('kpis.villages')}`, accent: 'primary' as const, icon: <Icon name="users" size={22} /> },
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

  if (!effectiveDistrictId) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <h2 className="text-headline-sm text-on-surface mb-4">Select District</h2>
        <div className="flex flex-col gap-4">
          <SearchableSelect
            id="dd_state"
            label="State *"
            options={(statesQuery.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
            showCode
            value={statePick}
            onChange={(id) => { setStatePick(id); setDistrictPick('') }}
            placeholder="Select state"
            loading={statesQuery.isLoading}
            loadingLabel="Loading states…"
          />
          <SearchableSelect
            id="dd_district"
            label="District *"
            options={(districtsQuery.data ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code }))}
            showCode
            value={districtPick}
            onChange={setDistrictPick}
            placeholder={effectiveStateId ? 'Select district' : 'Select a state first'}
            loading={districtsQuery.isLoading}
            loadingLabel="Loading districts…"
            disabled={!effectiveStateId}
            disabledHint="Select a state first"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

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
                { key: 'anc4', name: 'ANC4+', color: '#4F46E5' },
                { key: 'institutional', name: 'Institutional', color: '#10B981' },
                { key: 'immunization', name: 'Immunization', color: '#F59E0B' },
              ]}
            />
          ) : null}
          <Link to="/phc/phc-comparison" className="mt-3 inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline">
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
          <Link to="/phc/resources" className="mt-3 inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline">
            {t('district.allocateResources')}
            <Icon name="chevronRight" size={16} />
          </Link>
        </ASHACard>
      </div>
    </div>
  )
}
