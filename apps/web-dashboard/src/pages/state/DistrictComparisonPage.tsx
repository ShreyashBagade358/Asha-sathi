import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { dashboardService } from '@/services/dashboard.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { ComparisonChart } from '@/components/charts/ComparisonChart'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Icon } from '@/components/common/Icons'

const INDICATORS = [
  { key: 'anc4', label: 'ANC4+', color: '#006565' },
  { key: 'institutional', label: 'Institutional Deliveries', color: '#156820' },
  { key: 'immunization', label: 'Immunization', color: '#ac3509' },
  { key: 'ncd', label: 'NCD Screening', color: '#76d6d5' },
]

export default function DistrictComparisonPage() {
  const { t } = useLocalization()
  const [selected, setSelected] = useState<string[]>(['anc4', 'immunization'])

  const { data, isLoading } = useQuery({
    queryKey: ['state-dashboard', 'comparison'],
    queryFn: () => dashboardService.getStateDashboard(),
  })

  const toggleIndicator = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const chartSeries = useMemo(
    () => INDICATORS.filter((i) => selected.includes(i.key)).map((i) => ({ key: i.key, name: i.label, color: i.color })),
    [selected],
  )

  const chartData = useMemo(
    () =>
      (data?.districtComparison ?? []).map(
        (row): Record<string, string | number> => ({
          label: row.phcName,
          ...row.values,
        }),
      ),
    [data],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.districtComparison')}
        subtitle={t('state.comparisonSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/state/dashboard' }, { label: t('nav.districtComparison') }]}
      />

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
        <ComparisonChart data={chartData} xKey="label" series={chartSeries} height={360} />
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
