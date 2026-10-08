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
        <CardTitle className="text-base font-semibold tracking-tight">
          Kurs saat ini
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
              <p className="text-xs text-muted-foreground">
                Kurs dasar
              </p>
              <p
                className="mt-1 font-mono text-xl font-semibold leading-tight tracking-tight"
                aria-label="kurs dasar"
              >
                {formatRate(data.baseRate)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Kurs beli berlaku (mint)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="kurs beli berlaku"
                >
                  {formatRate(data.effectiveBuyRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Kurs jual berlaku (burn)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="kurs jual berlaku"
                >
                  {formatRate(data.effectiveSellRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Spread beli
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatSpreadPct(data.spreadBuyPct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Spread jual
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatSpreadPct(data.spreadSellPct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Mode
                </dt>
                <dd className="mt-1 text-sm font-medium">{data.mode}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Terakhir diubah
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
