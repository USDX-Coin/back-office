import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRate, formatSpreadPct, formatDateTime, rateModeLabel } from '@/lib/format'
import type { RateInfo } from '@/lib/types'

interface CurrentRateCardProps {
  data: RateInfo | undefined
  isLoading: boolean
  /** Tombol aksi utama di kanan atas kartu (mis. "Ubah kurs"); kosong untuk peran baca saja. */
  action?: ReactNode
}

export default function CurrentRateCard({ data, isLoading, action }: CurrentRateCardProps) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-section">
          Kurs saat ini
        </CardTitle>
        {action}
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
                className="mt-1 text-money-lg tabular-nums"
                aria-label="kurs dasar"
              >
                {formatRate(data.baseRate)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t lg:grid-cols-4 border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Kurs beli berlaku (mint)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="kurs beli berlaku"
                >
                  {formatRate(data.effectiveBuyRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Kurs jual berlaku (redeem)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
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
                <dd className="mt-1 text-sm font-medium">{rateModeLabel(data.mode)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Terakhir diubah (WIB)
                </dt>
                <dd
                  className="mt-1 text-sm text-muted-foreground"
                  title={data.updatedAt}
                >
                  {formatDateTime(data.updatedAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
