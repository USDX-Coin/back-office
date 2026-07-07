import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRate } from '@/features/rate/hooks'

// USDX-40 AC #6: rate displayed must match `GET /api/v1/rate`.
// Rendered inside Mint and Burn request pages so operators see the live
// snapshot before submitting (the BE captures `rateUsed` at submit time).
// USDX-27: renamed from CurrentRateCard — the name clashed with the
// props-based features/rate/CurrentRateCard; this one owns its own query.

function formatIdr(rate: string): string {
  const n = Number(rate)
  if (!Number.isFinite(n)) return rate
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)
}

// USDX-207: rate is directional — mint shows the buy (beli) side, burn the
// sell (jual) side. Default 'buy'.
export default function RateSnapshotCard({
  direction = 'buy',
}: {
  direction?: 'buy' | 'sell'
}) {
  const { data: rate, isLoading, isError } = useRate()
  const effective =
    direction === 'sell' ? rate?.effectiveSellRate : rate?.effectiveBuyRate
  const spread =
    direction === 'sell' ? rate?.spreadSellPct : rate?.spreadBuyPct

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Current rate USD/IDR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : isError || !rate ? (
          <p className="text-sm text-destructive">Could not load rate</p>
        ) : (
          <>
            <p
              className="text-[22px] font-semibold tracking-tight tabular-nums"
              data-testid="rate-display"
            >
              Rp {formatIdr(effective ?? rate.baseRate)}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {rate.mode === 'MANUAL' ? 'Manual rate' : 'Dynamic rate'} · spread{' '}
              {direction === 'sell' ? 'jual' : 'beli'} {spread}%
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
