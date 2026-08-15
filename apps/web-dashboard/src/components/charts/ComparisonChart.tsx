import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface ComparisonSeries {
  key: string
  name: string
  color: string
}

interface ComparisonChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  series: ComparisonSeries[]
  height?: number
}

export function ComparisonChart({ data, xKey, series, height = 300 }: ComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e1" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: '#3e4949', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#bdc9c8' }} interval={0} />
        <YAxis
          tick={{ fill: '#3e4949', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={44}
        />
        <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: 8, borderColor: '#e2e3e1' }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
