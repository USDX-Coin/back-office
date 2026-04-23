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
import { useTheme } from '@/lib/theme'

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

const LIGHT = {
  grid: '#e4e9ec',
  tick: '#3d484d',
  axis: 'rgba(188, 200, 206, 0.3)',
  tipBg: '#ffffff',
  tipBorder: 'rgba(188, 200, 206, 0.5)',
  tipText: '#171c1f',
  mint: '#006780',
  redeem: '#1eaed5',
}

const DARK = {
  grid: '#1f262b',
  tick: '#94a3b8',
  axis: 'rgba(148, 163, 184, 0.2)',
  tipBg: '#0f1419',
  tipBorder: 'rgba(71, 85, 105, 0.5)',
  tipText: '#f1f5f9',
  mint: '#22d3ee',
  redeem: '#7dd3fc',
}

export default function VolumeTrendChart({ data }: VolumeTrendChartProps) {
  const { resolvedTheme } = useTheme()
  const C = resolvedTheme === 'dark' ? DARK : LIGHT

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fill: C.tick, fontSize: 11 }}
          axisLine={{ stroke: C.axis }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={formatVolumeTick}
          tick={{ fill: C.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: C.tipBg,
            border: `1px solid ${C.tipBorder}`,
            borderRadius: 8,
            fontSize: 12,
            color: C.tipText,
          }}
          labelStyle={{ color: C.tipText }}
          itemStyle={{ color: C.tipText }}
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
        <Line type="monotone" dataKey="mint" stroke={C.mint} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="redeem" stroke={C.redeem} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
