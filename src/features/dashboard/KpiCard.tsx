import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  trend?: {
    direction: 'up' | 'down'
    percentChange: number
  }
  trendDescription?: string
  tone?: 'default' | 'warning'
}

export default function KpiCard({
  label,
  value,
  icon,
  trend,
  trendDescription,
  tone = 'default',
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              tone === 'warning' ? 'bg-warning/15' : 'bg-primary/10'
            )}
          >
            {icon}
          </div>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                trend.direction === 'up' ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.percentChange.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        {trendDescription && (
          <p className="mt-1 text-xs text-muted-foreground">{trendDescription}</p>
        )}
      </CardContent>
    </Card>
  )
}
