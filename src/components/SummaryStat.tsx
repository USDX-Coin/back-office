import type { ReactNode } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SummaryStatProps {
  label: string
  value: ReactNode
  delta?: { direction: 'up' | 'down'; value: string }
  hint?: string
}

export default function SummaryStat({
  label,
  value,
  delta,
  hint,
}: SummaryStatProps) {
  return (
    <Card className="rounded-md py-0 gap-0 shadow-none dark:border-0">
      <CardContent className="px-4 py-3.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5',
                delta.direction === 'up'
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {delta.direction === 'up' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {delta.value}
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
