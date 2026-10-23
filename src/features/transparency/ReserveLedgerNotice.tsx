import { Info } from 'lucide-react'
import { RESERVE_LEDGER_NOT_PUBLIC_NOTICE } from '@/lib/transparency'

/**
 * Keterangan tetap § 18.5 (D26) di bagian buku besar: dirender di kartu saldo,
 * jadi terbaca sebelum tombol "Catat entri" membuka form — untuk semua peran,
 * bukan hanya Admin yang mencatat.
 */
export default function ReserveLedgerNotice() {
  return (
    <p
      role="note"
      data-testid="reserve-ledger-notice"
      className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{RESERVE_LEDGER_NOT_PUBLIC_NOTICE}</span>
    </p>
  )
}
