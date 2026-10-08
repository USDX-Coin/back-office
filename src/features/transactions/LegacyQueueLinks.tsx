import { Link } from 'react-router'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import type { QueueCounts } from '@/lib/types'

const QUEUES: Array<{ to: string; label: string; pick?: (c: QueueCounts) => number | undefined }> = [
  { to: '/redeem-approvals', label: 'Persetujuan Pencairan', pick: (c) => c.redeemApprovalsOpen },
  { to: '/payout-failures', label: 'Pencairan Bermasalah', pick: (c) => c.payoutFailuresOpen },
  { to: '/mint-bermasalah', label: 'Mint Bermasalah', pick: (c) => c.heldCreditsOpen },
  { to: '/manual-sync', label: 'Perbaiki Status Nyangkut' },
]

/**
 * Jembatan fase 1. Empat antrean lama keluar dari menu (keputusan PM: fase 2
 * meleburnya ke tabel Transaksi), dan angka tiga di antaranya dijumlah ke menu
 * Transaksi. Tanpa baris ini angka itu menunjuk ke halaman yang tidak bisa
 * dicapai kecuali dengan mengetik URL — jadi tautannya ditaruh di sini,
 * dengan angka yang sama dengan menu (satu `GET /api/v1/queue-counts`).
 */
export default function LegacyQueueLinks() {
  const q = useQueueCounts()
  return (
    <nav
      aria-label="Antrean yang perlu tindakan"
      className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm"
    >
      <span className="mr-1 font-medium text-muted-foreground">Perlu tindakan:</span>
      {QUEUES.map((item) => {
        const n = item.pick && q.data ? item.pick(q.data) : undefined
        const unread = Boolean(item.pick) && (q.isError || (q.data && typeof n !== 'number'))
        return (
          <Link
            key={item.to}
            to={item.to}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
            {typeof n === 'number' && n > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs font-semibold tabular-nums text-primary">
                {n > 99 ? '99+' : n}
              </span>
            )}
            {unread && (
              <span className="text-xs text-muted-foreground" title="Jumlah antrean belum terbaca — bukan berarti kosong">
                (belum terbaca)
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
