import { useLocalization } from '@/hooks/useLocalization'

export interface HeatmapIndicator {
  key: string
  label: string
}

interface HeatmapChartProps {
  rows: string[]
  indicators: HeatmapIndicator[]
  values: Record<string, number>
}

function cellClasses(value: number): string {
  if (value >= 85) return 'bg-tertiary text-on-tertiary'
  if (value >= 70) return 'bg-tertiary-container text-on-tertiary'
  if (value >= 50) return 'bg-[#ffdf9e] text-on-surface'
  if (value >= 30) return 'bg-[#f4a261] text-white'
  return 'bg-error text-on-error'
}

export function HeatmapChart({ rows, indicators, values }: HeatmapChartProps) {
  const { t } = useLocalization()

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `140px repeat(${indicators.length}, minmax(72px, 1fr))`, minWidth: 320 }}
      >
        <div />
        {indicators.map((ind) => (
          <div key={ind.key} className="px-1 pb-1 text-center text-label-md font-semibold text-on-surface-variant">
            {ind.label}
          </div>
        ))}
        {rows.map((row) => (
          <RowCells key={row} row={row} indicators={indicators} values={values} />
        ))}
      </div>
      <p className="mt-3 text-label-md text-on-surface-variant">{t('charts.indicator')} (%)</p>
    </div>
  )
}

function RowCells({
  row,
  indicators,
  values,
}: {
  row: string
  indicators: HeatmapIndicator[]
  values: Record<string, number>
}) {
  return (
    <>
      <div className="flex items-center px-1 text-body-md font-medium text-on-surface">{row}</div>
      {indicators.map((ind) => {
        const value = values[`${row}|${ind.key}`] ?? 0
        return (
          <div
            key={`${row}-${ind.key}`}
            title={`${row} · ${ind.label}: ${value}%`}
            className={`flex h-10 items-center justify-center rounded-md text-label-md font-semibold ${cellClasses(value)}`}
          >
            {value}%
          </div>
        )
      })}
    </>
  )
}
