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

export default function PHCComparisonPage() {
  const { t } = useLocalization()
  const [selected, setSelected] = useState<string[]>(['anc4', 'immunization'])

  const { data, isLoading } = useQuery({
    queryKey: ['district-dashboard', 'comparison'],
    queryFn: () => dashboardService.getDistrictDashboard('dist-demo'),
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
      (data?.phcComparison ?? []).map(
        (row): Record<string, string | number> => ({
          label: row.phcName.replace('PHC ', ''),
          ...row.values,
        }),
      ),
    [data],
  )

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.phcComparison')}
        subtitle={t('district.comparisonSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/district/dashboard' }, { label: t('nav.phcComparison') }]}
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

      <ASHACard title={t('charts.phcComparison')}>
        <ComparisonChart data={chartData} xKey="label" series={chartSeries} height={340} />
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
