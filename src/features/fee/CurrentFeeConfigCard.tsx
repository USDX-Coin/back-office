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
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Current fee config
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
                Mint fee (% dari subtotal)
              </p>
              <p
                className="mt-1 font-mono text-[28px] font-semibold leading-tight tracking-tight"
                aria-label="mint fee percent"
              >
                {formatSpreadPct(data.mintFeePct)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  PG fee VA (flat)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="pg fee va flat"
                >
                  {formatIdrAmount(Number(data.pgFeeVaFlat))}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  PG fee QRIS (%)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="pg fee qris percent"
                >
                  {formatSpreadPct(data.pgFeeQrisPct)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Redeem fee (%)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="redeem fee percent"
                >
                  {formatSpreadPct(data.redeemFeePct)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Disbursement fee (flat)
                </dt>
                <dd
                  className="mt-1 font-mono text-sm font-medium"
                  aria-label="disbursement fee flat"
                >
                  {formatIdrAmount(Number(data.disbursementFeeFlat))}
                </dd>
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
