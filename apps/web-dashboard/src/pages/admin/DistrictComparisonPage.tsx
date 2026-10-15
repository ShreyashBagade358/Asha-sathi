import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
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

export default function DistrictComparisonPage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const [statePick, setStatePick] = useState('')
  const [selected, setSelected] = useState<string[]>(['anc4', 'immunization'])
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

  const toggleIndicator = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const chartSeries = useMemo(
    () => INDICATORS.filter((i) => selected.includes(i.key)).map((i) => ({ key: i.key, name: i.label, color: i.color })),
    [selected],
  )

  const chartData = useMemo(() => {
    const rows = (data?.districtComparison ?? []).map(
      (row): Record<string, string | number> => ({
        label: row.phcName,
        ...row.values,
      }),
    )
    const filtered = rows.filter((row) => selected.some((k) => Number(row[k]) > 0))
    filtered.sort((a, b) => {
      const sumA = selected.reduce((s, k) => s + Number(a[k] ?? 0), 0)
      const sumB = selected.reduce((s, k) => s + Number(b[k] ?? 0), 0)
      return sumB - sumA
    })
    return filtered.slice(0, 15)
  }, [data, selected])

  if (isLoading) return <LoadingSpinner fullPage />

  if (!effectiveStateId) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <h2 className="text-headline-sm text-on-surface mb-4">Select State</h2>
        <SearchableSelect
          id="dc_state"
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

      <ASHACard title={t('charts.districtWise')}>
        {chartData.length > 0 ? (
          <ComparisonChart data={chartData} xKey="label" series={chartSeries} height={360} />
        ) : (
          <p className="py-10 text-center text-body-md text-on-surface-variant">
            No comparison data yet — no district has recorded values for the selected indicators.
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
              {chartData.map((row) => {
                const values = chartSeries.map((s) => Number(row[s.key] ?? 0))
                const best = Math.max(...values)
                return (
                  <tr key={String(row.label)} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {row.label}
                      {values.filter((v) => v === best).length === values.length && values.length > 0 ? (
                        <Icon name="checkCircle" size={16} className="ml-2 inline text-tertiary" />
                      ) : null}
                    </td>
                    {chartSeries.map((s) => {
                      const v = Number(row[s.key] ?? 0)
                      return (
                        <td key={s.key} className="px-4 py-3 text-right">
                          <span className={`font-semibold ${v === best ? 'text-tertiary' : v >= 75 ? 'text-primary' : 'text-error'}`}>
                            {v}% <Icon name="activity" size={14} className="inline" />
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ASHACard>
    </div>
  )
}
