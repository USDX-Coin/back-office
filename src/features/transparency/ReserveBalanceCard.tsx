import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmountDecimal } from '@/lib/transparency'
import type { ReserveBalance } from '@/lib/types'

interface Props {
  /** `data.balance` from the ledger response — the WHOLE ledger's balance. */
  balance: ReserveBalance | undefined
  isLoading: boolean
}

/**
 * The reserve figure the public page shows.
 *
 * It comes from the `balance` field the server computes over every entry. It is
 * NOT derived from the rows in the table below: those rows are a single page, so
 * adding them up would silently under-report the reserve the moment the ledger
 * outgrows one page — and quietly publishing a too-low reserve is the worst
 * failure this screen has.
 */
export default function ReserveBalanceCard({ balance, isLoading }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Reserve balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-56" />
        ) : balance ? (
          <>
            <p
              aria-label="Reserve balance"
              className="font-mono text-[28px] font-semibold leading-none tracking-tight text-foreground"
            >
              {formatAmountDecimal(balance.amount)}{' '}
              <span className="text-[16px] font-medium text-muted-foreground">
                {balance.currency}
              </span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Sum of every entry in the ledger, calculated by the server. This is
              the figure published on usdx.co.id.
            </p>
          </>
        ) : (
          <>
            <p
              aria-label="Reserve balance"
              className="font-mono text-[28px] font-semibold leading-none tracking-tight text-muted-foreground"
            >
              —
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              No reserve balance yet. The public page shows nothing until the
              first entry is recorded.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
