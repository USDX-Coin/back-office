import { Wallet, Users, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ReportInsights } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ReportInsightsBentoProps {
  data: ReportInsights | undefined
}

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toLocaleString()}`
}

export default function ReportInsightsBento({ data }: ReportInsightsBentoProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <InsightCard
        icon={<Wallet className="h-5 w-5 text-primary" />}
        label="Total Volume"
        value={data ? formatUSD(data.totalVolume) : '—'}
        trend={data?.trends.volume}
      />
      <InsightCard
        icon={<Users className="h-5 w-5 text-warning" />}
        label="Active Minters"
        value={data ? data.activeMinters.toLocaleString() : '—'}
        trend={data?.trends.minters}
      />
      <InsightCard
        icon={<AlertTriangle className="h-5 w-5 text-warning" />}
        label="Flagged Transactions"
        value={data ? data.flagged.toLocaleString() : '—'}
        description={data && data.flagged === 0 ? 'Queue clear' : 'Requires review'}
      />
    </div>
  )
}

interface InsightCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  trend?: { direction: 'up' | 'down'; percentChange: number }
  description?: string
}

function InsightCard({ icon, label, value, trend, description }: InsightCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60">
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
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}
