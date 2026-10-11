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
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Kurs saat ini USD/IDR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : isError || !rate ? (
          <p className="text-sm text-destructive">Kurs gagal dimuat</p>
        ) : (
          <>
            <p
              className="text-money-lg tabular-nums"
              data-testid="rate-display"
            >
              Rp {formatIdr(effective ?? rate.baseRate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rate.mode === 'MANUAL' ? 'Kurs manual' : 'Kurs dinamis'} · spread{' '}
              {direction === 'sell' ? 'jual' : 'beli'} {spread}%
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
