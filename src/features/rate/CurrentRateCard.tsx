import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRate, formatSpreadPct, formatDateTime, rateModeLabel } from '@/lib/format'
import type { RateInfo } from '@/lib/types'
import BniRateStamp from './BniRateStamp'

interface CurrentRateCardProps {
  data: RateInfo | undefined
  isLoading: boolean
  /** Tombol aksi utama di kanan atas kartu (mis. "Ubah kurs"); kosong untuk peran baca saja. */
  action?: ReactNode
}

// Backend sebelum USDX-749 tidak mengirim field kurs dua harga; "—" di situ
// berarti "server belum mengirim", bukan nol.
function optionalRate(rate: string | null | undefined): string {
  return rate != null && rate !== '' ? formatRate(rate) : '—'
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

            {/* D25 (`sot/api/rate.yaml § RateInfo`, `bni-integration.md § 4.3.3`):
                mint KONSUMEN punya dua kurs beli. Transfer BNI = kurs BNI yang
                diisi admin dari wondr; Virtual Account = dasar × (1 + Y%). */}
            <section aria-labelledby="consumer-buy-rates" className="space-y-3 border-t border-border pt-4">
              <h3 id="consumer-buy-rates" className="text-label text-muted-foreground">
                Kurs beli mint nasabah (web &amp; aplikasi)
              </h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-muted/40 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Transfer BNI</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums" aria-label="kurs beli transfer BNI">
                    {data.bniBuyRate === null ? 'Belum diisi' : optionalRate(data.bniBuyRate)}
                  </dd>
                  <dd className="mt-0.5 space-y-0.5 text-xs">
                    {data.bniBuyRate === null ? (
                      <span className="text-muted-foreground">
                        Transfer BNI tidak ditawarkan ke nasabah sampai kurs BNI diisi.
                      </span>
                    ) : (
                      <>
                        <span className="block text-muted-foreground">Kurs BNI dari aplikasi wondr, diisi Admin.</span>
                        <BniRateStamp updatedAt={data.bniBuyRateUpdatedAt} />
                      </>
                    )}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Virtual Account</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums" aria-label="kurs beli virtual account">
                    {optionalRate(data.gatewayBuyRate)}
                  </dd>
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    Kurs dasar + markup{' '}
                    <span className="tabular-nums" aria-label="markup virtual account">
                      {data.gatewayMarkupPct != null ? formatSpreadPct(data.gatewayMarkupPct) : '—'}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t lg:grid-cols-4 border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Kurs beli OTC &amp; Partner
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
                  Spread beli (OTC &amp; Partner)
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
