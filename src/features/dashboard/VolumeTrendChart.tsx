import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  grid: 'hsl(220 13% 91%)',
  tick: 'hsl(220 9% 46%)',
  tipBg: '#ffffff',
  tipBorder: 'hsl(220 13% 91%)',
  tipText: 'hsl(220 13% 9%)',
  mint: '#006780',
  redeem: '#1eaed5',
}

const DARK = {
  grid: 'hsl(220 8% 14%)',
  tick: 'hsl(220 6% 56%)',
  tipBg: 'hsl(220 13% 7%)',
  tipBorder: 'hsl(220 8% 14%)',
  tipText: 'hsl(220 6% 91%)',
  mint: '#1eaed5',
  redeem: '#7dd3fc',
}

const MONO = "'JetBrains Mono', monospace"

export default function VolumeTrendChart({ data }: VolumeTrendChartProps) {
  const { resolvedTheme } = useTheme()
  const C = resolvedTheme === 'dark' ? DARK : LIGHT

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fill: C.tick, fontSize: 10.5, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={formatVolumeTick}
          tick={{ fill: C.tick, fontSize: 10.5, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: C.tipBg,
            border: `1px solid ${C.tipBorder}`,
            borderRadius: 5,
            fontSize: 12,
            color: C.tipText,
            padding: '8px 10px',
          }}
          labelStyle={{ color: C.tipText, fontSize: 11, fontFamily: MONO }}
          itemStyle={{ color: C.tipText, fontFamily: MONO }}
          labelFormatter={(label) => formatDateTick(label as string)}
          formatter={(value, name) => {
            const v = typeof value === 'number' ? value : Number(value)
            const n = String(name)
            return [
              `$${v.toLocaleString()}`,
              n.charAt(0).toUpperCase() + n.slice(1),
            ]
          }}
        />
        <Line
          type="monotone"
          dataKey="mint"
          stroke={C.mint}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="redeem"
          stroke={C.redeem}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
