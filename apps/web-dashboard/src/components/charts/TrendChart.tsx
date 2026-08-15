import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface TrendPoint {
  label: string
  value: number
}

interface TrendChartProps {
  data: TrendPoint[]
  color?: string
  height?: number
  ySuffix?: string
}

export function TrendChart({ data, color = '#006565', height = 260, ySuffix = '%' }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e1" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#3e4949', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#bdc9c8' }} />
        <YAxis
          tick={{ fill: '#3e4949', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}${ySuffix}`}
          width={44}
        />
        <Tooltip
          formatter={(value) => [`${value}${ySuffix}`, '']}
          contentStyle={{ borderRadius: 8, borderColor: '#e2e3e1' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
