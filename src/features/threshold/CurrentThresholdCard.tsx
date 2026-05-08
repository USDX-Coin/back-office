import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/format'
import type { ThresholdConfig } from '@/lib/types'

interface Props {
  data: ThresholdConfig | undefined
  isLoading: boolean
}

function formatAmount(amount: string, mode: 'USD' | 'IDR'): string {
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  if (mode === 'IDR') {
    return `Rp ${n.toLocaleString('id-ID')}`
  }
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

export default function CurrentThresholdCard({ data, isLoading }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Current threshold
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
                Routes ≥ this amount to the Manager Safe
              </p>
              <p
                className="mt-1 font-mono text-[28px] font-semibold leading-tight tracking-tight"
                aria-label="threshold amount"
              >
                {formatAmount(data.amount, data.mode)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Mode
                </dt>
                <dd className="mt-1 text-sm font-medium">{data.mode}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Last updated
                </dt>
                <dd
                  className="mt-1 text-sm text-muted-foreground"
                  title={data.createdAt}
                >
                  {formatRelativeTime(data.createdAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
