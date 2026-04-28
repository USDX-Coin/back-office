import SummaryStat from '@/components/SummaryStat'
import type { ReportInsights } from '@/lib/types'

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
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryStat
        label="Total volume"
        value={data ? formatUSD(data.totalVolume) : '—'}
        delta={
          data?.trends.volume
            ? {
                direction: data.trends.volume.direction,
                value: `${data.trends.volume.percentChange.toFixed(1)}%`,
              }
            : undefined
        }
        hint="vs prior range"
      />
      <SummaryStat
        label="Active minters"
        value={data ? data.activeMinters.toLocaleString() : '—'}
        delta={
          data?.trends.minters
            ? {
                direction: data.trends.minters.direction,
                value: `${data.trends.minters.percentChange.toFixed(1)}%`,
              }
            : undefined
        }
        hint="unique customers"
      />
      <SummaryStat
        label="Flagged transactions"
        value={data ? data.flagged.toLocaleString() : '—'}
        hint={
          data && data.flagged === 0 ? 'Queue clear' : 'Requires review'
        }
      />
    </div>
  )
}
