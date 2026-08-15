import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface CoverageSeries {
  key: string
  name: string
  color: string
}

export interface CoverageDatum {
  label: string
  [seriesKey: string]: string | number
}

interface CoverageChartProps {
  data: CoverageDatum[]
  series: CoverageSeries[]
  height?: number
  type?: 'area' | 'bar'
}

export function CoverageChart({ data, series, height = 280, type = 'area' }: CoverageChartProps) {
  const chartProps = {
    data,
    margin: { top: 8, right: 12, left: 0, bottom: 0 },
  }

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e1" vertical={false} />
      <XAxis dataKey="label" tick={{ fill: '#3e4949', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#bdc9c8' }} />
      <YAxis
        tick={{ fill: '#3e4949', fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => `${v}%`}
        width={40}
      />
      <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: 8, borderColor: '#e2e3e1' }} />
      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
    </>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'area' ? (
        <AreaChart {...chartProps}>
          {commonAxes}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart {...chartProps}>
          {commonAxes}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}
