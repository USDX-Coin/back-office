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
//
// D28 (`bni-integration.md` §20.1 D28-c, §20.4): OTC ikut mode kurs aktif. Pada
// mode BNI kurs bisa tidak tersedia (field kurs `null`) — mint/burn OTC
// sementara itu ditolak server 503 RATE_UNAVAILABLE.
const MODE_LABEL: Record<string, string> = {
  MANUAL: 'Kurs manual',
  DYNAMIC: 'Kurs dinamis',
  BNI: 'Kurs BNI',
}

export default function RateSnapshotCard({
  direction = 'buy',
}: {
  direction?: 'buy' | 'sell'
}) {
  const { data: rate, isLoading, isError } = useRate()
  // Fallback ke dasar arahnya lalu ke dasar beli (perilaku lama). `null` di
  // semuanya = kurs BNI tidak tersedia.
  const effective =
    (direction === 'sell' ? rate?.effectiveSellRate : rate?.effectiveBuyRate) ??
    (direction === 'sell' ? rate?.baseSellRate : undefined) ??
    rate?.baseRate
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
        ) : effective == null ? (
          <p className="text-sm text-destructive" data-testid="rate-unavailable">
            Kurs BNI tidak tersedia — mint/burn OTC sementara ditolak server.
          </p>
        ) : (
          <>
            <p
              className="text-money-lg tabular-nums"
              data-testid="rate-display"
            >
              Rp {formatIdr(effective)}
            </p>
            <p className="text-xs text-muted-foreground">
              {MODE_LABEL[rate.mode] ?? rate.mode} · spread{' '}
              {direction === 'sell' ? 'jual' : 'beli'} {spread}%
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
