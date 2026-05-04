import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRate, formatSpreadPct, formatRelativeTime } from '@/lib/format'
import type { RateInfo } from '@/lib/types'

interface CurrentRateCardProps {
  data: RateInfo | undefined
  isLoading: boolean
}

export default function CurrentRateCard({ data, isLoading }: CurrentRateCardProps) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Current rate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Effective rate
              </p>
              <p
                className="mt-1 font-mono text-[28px] font-semibold leading-tight tracking-tight"
                aria-label="effective rate"
              >
                {formatRate(data.rate)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Mode
                </dt>
                <dd className="mt-1 text-sm font-medium">{data.mode}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Spread
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatSpreadPct(data.spreadPct)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Last updated
                </dt>
                <dd
                  className="mt-1 text-sm text-muted-foreground"
                  title={data.updatedAt}
                >
                  {formatRelativeTime(data.updatedAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
