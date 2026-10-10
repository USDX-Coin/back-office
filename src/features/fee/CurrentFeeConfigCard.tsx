import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIdrAmount, formatDateTime, formatSpreadPct } from '@/lib/format'
import type { FeeConfig } from '@/lib/types'

interface Props {
  data: FeeConfig | undefined
  isLoading: boolean
  /** Tombol aksi utama di kanan atas kartu (mis. "Ubah kurs"); kosong untuk peran baca saja. */
  action?: ReactNode
}

export default function CurrentFeeConfigCard({ data, isLoading, action }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-section">
          Biaya saat ini
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
                Biaya mint (% dari subtotal)
              </p>
              <p
                className="mt-1 text-money-lg tabular-nums"
                aria-label="persen biaya mint"
              >
                {formatSpreadPct(data.mintFeePct)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t lg:grid-cols-4 border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Biaya VA (flat)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="biaya VA flat"
                >
                  {formatIdrAmount(Number(data.pgFeeVaFlat))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Biaya QRIS (%)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="persen biaya QRIS"
                >
                  {formatSpreadPct(data.pgFeeQrisPct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Biaya redeem (%)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="persen biaya redeem"
                >
                  {formatSpreadPct(data.redeemFeePct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Biaya pencairan (flat)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
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
                <dt className="text-xs text-muted-foreground">
                  Minimum Mint (Rp)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="minimum mint aktif"
                >
                  {data.minMintIdr ? formatIdrAmount(Number(data.minMintIdr)) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Minimum Redeem (Rp)
                </dt>
                <dd
                  className="tabular-nums mt-1 text-sm font-medium"
                  aria-label="minimum redeem aktif"
                >
                  {data.minRedeemIdr ? formatIdrAmount(Number(data.minRedeemIdr)) : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Terakhir diubah (WIB)
                </dt>
                <dd
                  className="mt-1 text-sm text-muted-foreground"
                  title={data.createdAt}
                >
                  {formatDateTime(data.createdAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
