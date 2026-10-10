import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmountDecimal } from '@/lib/transparency'
import type { ReserveBalance } from '@/lib/types'
import type { ReactNode } from 'react'

interface Props {
  /** `data.balance` from the ledger response — the WHOLE ledger's balance. */
  balance: ReserveBalance | undefined
  isLoading: boolean
  /** Aksi utama di kanan atas kartu ("Catat entri", Admin saja). */
  action?: ReactNode
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
export default function ReserveBalanceCard({ balance, isLoading, action }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-section">
          Saldo cadangan
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-56" />
        ) : balance ? (
          <>
            <p
              aria-label="Saldo cadangan"
              className="text-money-lg tabular-nums text-foreground"
            >
              {formatAmountDecimal(balance.amount)}{' '}
              <span className="text-base font-medium text-muted-foreground">
                {balance.currency}
              </span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Jumlah seluruh entri di buku besar, dihitung oleh server. Angka
              inilah yang tayang di usdx.co.id.
            </p>
          </>
        ) : (
          <>
            <p
              aria-label="Saldo cadangan"
              className="text-money-lg tabular-nums text-muted-foreground"
            >
              —
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Belum ada saldo cadangan. Halaman publik belum menampilkan angka
              apa pun sampai entri pertama dicatat.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
