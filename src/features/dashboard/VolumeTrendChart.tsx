import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

export interface VolumeTrendPoint {
  date: string
  mint: number
  redeem: number
}

interface VolumeTrendChartProps {
  data: VolumeTrendPoint[]
}

function formatDateTick(value: string): string {
  const d = new Date(value)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatVolumeTick(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`
  return `$${value}`
}

export default function VolumeTrendChart({ data }: VolumeTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e9ec" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fill: '#3d484d', fontSize: 11 }}
          axisLine={{ stroke: '#bcc8ce', strokeOpacity: 0.3 }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={formatVolumeTick}
          tick={{ fill: '#3d484d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid rgba(188, 200, 206, 0.3)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(label) => formatDateTick(label as string)}
          formatter={(value, name) => {
            const v = typeof value === 'number' ? value : Number(value)
            const n = String(name)
            return [`$${v.toLocaleString()}`, n.charAt(0).toUpperCase() + n.slice(1)]
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
        />
        <Line
          type="monotone"
          dataKey="mint"
          stroke="#006780"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="redeem"
          stroke="#1eaed5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
