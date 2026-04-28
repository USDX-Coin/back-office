import type { ReactNode } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  label: string
  value: ReactNode
  trend?: { direction: 'up' | 'down'; percentChange: number }
  trendDescription?: string
  sparkline?: number[]
  tone?: 'default' | 'warning'
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 48
  const h = 14
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 1) - 0.5
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={w}
      height={h}
      className="text-muted-foreground/60"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export default function KpiCard({
  label,
  value,
  trend,
  trendDescription,
  sparkline,
  tone = 'default',
}: KpiCardProps) {
  return (
    <Card className="rounded-md py-0 gap-0 shadow-none dark:border-0">
      <CardContent className="px-4 py-3.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{label}</span>
          {sparkline && sparkline.length > 0 && (
            <span className="ml-auto">
              <Sparkline values={sparkline} />
            </span>
          )}
        </div>
        <p
          className={cn(
            'mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums',
            tone === 'warning' && 'text-warning'
          )}
        >
          {value}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5',
                trend.direction === 'up'
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {trend.direction === 'up' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {trend.percentChange.toFixed(1)}%
            </span>
          )}
          {trendDescription && <span className="truncate">{trendDescription}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
