import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

const INDICATORS = [
  { key: 'anc4', label: 'ANC4+', color: '#4F46E5' },
  { key: 'institutional', label: 'Institutional Deliveries', color: '#10B981' },
  { key: 'immunization', label: 'Immunization', color: '#F59E0B' },
  { key: 'ncd', label: 'NCD Screening', color: '#10B981' },
]

export default function PHCComparisonPage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const [statePick, setStatePick] = useState('')
  const [districtPick, setDistrictPick] = useState('')
  const effectiveStateId = user?.stateId || statePick
  const effectiveDistrictId = user?.districtId || districtPick
  const [selected, setSelected] = useState<string[]>(['anc4', 'immunization'])

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
    queryFn: () => dashboardService.getDistrictDashboard(effectiveDistrictId || undefined),
    enabled: Boolean(effectiveDistrictId),
  })

  const toggleIndicator = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const chartSeries = useMemo(
    () => INDICATORS.filter((i) => selected.includes(i.key)).map((i) => ({ key: i.key, name: i.label, color: i.color })),
    [selected],
  )

  const chartData = useMemo(() => {
    const rows = (data?.phcComparison ?? [])
      .map(
        (row): Record<string, string | number> => ({
          label: row.phcName.replace('PHC ', ''),
          ...row.values,
        }),
      )
      .filter((row) => selected.some((k) => Number(row[k]) > 0))
    rows.sort((a, b) => {
      const sumA = selected.reduce((s, k) => s + Number(a[k] ?? 0), 0)
      const sumB = selected.reduce((s, k) => s + Number(b[k] ?? 0), 0)
      return sumB - sumA
    })
    return rows.slice(0, 12)
  }, [data, selected])

  if (isLoading) return <LoadingSpinner fullPage />

  if (!effectiveDistrictId) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <h2 className="text-headline-sm text-on-surface mb-4">Select District</h2>
        <div className="flex flex-col gap-4">
          <SearchableSelect
            id="pc_state"
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
            id="pc_district"
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
      <ASHACard title={t('district.compareIndicators')}>
        <div className="flex flex-wrap gap-2">
          {INDICATORS.map((ind) => {
            const isOn = selected.includes(ind.key)
            return (
              <button
                key={ind.key}
                type="button"
                onClick={() => toggleIndicator(ind.key)}
                className={`h-touch rounded-full px-4 text-label-lg font-semibold transition-colors ${
                  isOn ? 'bg-primary text-on-primary' : 'border border-outline bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ind.color }} />
                {ind.label}
              </button>
            )
          })}
        </div>
      </ASHACard>

      <ASHACard title={t('charts.phcComparison')}>
        {chartData.length > 0 ? (
          <ComparisonChart data={chartData} xKey="label" series={chartSeries} height={340} />
        ) : (
          <p className="py-10 text-center text-body-md text-on-surface-variant">
            No comparison data yet — no PHC has recorded values for the selected indicators.
          </p>
        )}
      </ASHACard>

      <ASHACard title={t('charts.phcComparison')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">{t('district.phcName')}</th>
                {chartSeries.map((s) => (
                  <th key={s.key} className="px-4 py-3 text-right text-label-md uppercase tracking-wide text-on-surface-variant">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {chartData.map((row) => (
                <tr key={String(row.label)} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-medium text-on-surface">{row.label}</td>
                  {chartSeries.map((s) => {
                    const v = Number(row[s.key] ?? 0)
                    return (
                      <td key={s.key} className="px-4 py-3 text-right">
                        <span className={`font-semibold ${v >= 75 ? 'text-tertiary' : v >= 50 ? 'text-primary' : 'text-error'}`}>
                          {v}% <Icon name="activity" size={14} className="inline" />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ASHACard>
    </div>
  )
}
