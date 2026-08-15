import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHAButton, ASHACard } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { reportService, type ReportKind } from '@/services/report.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Icon } from '@/components/common/Icons'

const TABS: Array<{ kind: ReportKind; labelKey: string }> = [
  { kind: 'maternal', labelKey: 'reports.maternal' },
  { kind: 'child', labelKey: 'reports.child' },
  { kind: 'immunization', labelKey: 'reports.immunization' },
  { kind: 'ncd', labelKey: 'reports.ncd' },
  { kind: 'incentive', labelKey: 'reports.incentive' },
]

export default function ReportsPage() {
  const { t } = useLocalization()
  const [active, setActive] = useState<ReportKind>('maternal')

  const { data, isLoading } = useQuery({
    queryKey: ['report', active],
    queryFn: () => reportService.getReport(active),
  })

  const columns: Column<Record<string, string | number>>[] = useMemo(
    () =>
      (data?.columns ?? []).map((col, idx) => ({
        key: col,
        header: col,
        sortable: idx > 0,
        align: idx > 0 ? ('right' as const) : ('left' as const),
        render: (row) => (
          <span className={idx === 0 ? 'font-medium text-on-surface' : 'font-semibold text-primary'}>
            {row[col]}
          </span>
        ),
      })),
    [data],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/phc/dashboard' }, { label: t('nav.reports') }]}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setActive(tab.kind)}
            className={`h-touch rounded-full px-5 text-label-lg font-semibold transition-colors ${
              active === tab.kind
                ? 'bg-primary text-on-primary'
                : 'border border-outline bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <ASHACard
        title={data?.title ?? t('reports.title')}
        subtitle={t('common.lastUpdated') + ': ' + new Date().toLocaleDateString()}
      >
        <div className="mb-4 flex justify-end">
          <ASHAButton
            variant="outline"
            fullWidth={false}
            icon={<Icon name="download" size={16} />}
            onClick={() => data && reportService.exportExcel(data)}
            label={t('common.exportExcel')}
          />
        </div>
        <DataTable columns={columns} data={data?.rows ?? []} loading={isLoading} keyExtractor={(r) => String(r[data?.columns[0] ?? 'Month'] ?? JSON.stringify(r))} />
      </ASHACard>

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
        <MetricTile label={t('common.rows')} value={data?.rows.length ?? 0} />
        <MetricTile label="Σ" value={sumRows(data?.rows ?? [])} />
        <MetricTile label={t('reports.view')} value={data?.kind ?? '—'} />
      </div>
    </div>
  )
}

function sumRows(rows: Array<Record<string, string | number>>): number {
  const nums = rows.flatMap((r) => Object.values(r)).filter((v): v is number => typeof v === 'number')
  return nums.reduce((a, b) => a + b, 0)
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <ASHACard title={label}>
      <p className="text-[28px] font-bold text-on-surface">{value}</p>
    </ASHACard>
  )
}
