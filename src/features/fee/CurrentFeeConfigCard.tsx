import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIdrAmount, formatRelativeTime, formatSpreadPct } from '@/lib/format'
import type { FeeConfig } from '@/lib/types'

interface Props {
  data: FeeConfig | undefined
  isLoading: boolean
}

export default function CurrentFeeConfigCard({ data, isLoading }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Biaya saat ini
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
              <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                Biaya mint (% dari subtotal)
              </p>
              <p
                className="mt-1 font-mono text-xl font-semibold leading-tight tracking-tight"
                aria-label="persen biaya mint"
              >
                {formatSpreadPct(data.mintFeePct)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Biaya VA (flat)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="biaya VA flat"
                >
                  {formatIdrAmount(Number(data.pgFeeVaFlat))}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Biaya QRIS (%)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="persen biaya QRIS"
                >
                  {formatSpreadPct(data.pgFeeQrisPct)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Biaya redeem (%)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="persen biaya redeem"
                >
                  {formatSpreadPct(data.redeemFeePct)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Biaya pencairan (flat)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="biaya pencairan flat"
                >
                  {formatIdrAmount(Number(data.disbursementFeeFlat))}
                </dd>
              </div>
              {/* Minimum mint (USDX-637) + minimum redeem (USDX-682). Nilai
                  kosong dirender sebagai em dash, bukan "Rp 0": backend yang
                  belum membawa kolomnya dan minimum yang benar-benar nol adalah
                  dua hal berbeda, dan yang kedua tidak pernah sah. */}
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Minimum Mint (Rp)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="minimum mint aktif"
                >
                  {data.minMintIdr ? formatIdrAmount(Number(data.minMintIdr)) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Minimum Redeem (Rp)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="minimum redeem aktif"
                >
                  {data.minRedeemIdr ? formatIdrAmount(Number(data.minRedeemIdr)) : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Terakhir diubah
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
