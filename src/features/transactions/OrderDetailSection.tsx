import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import { useOrderDetail } from './hooks'
import OrderDetailContent from './OrderDetailContent'

/**
 * Seksi "Rincian order" yang bisa dibuka-tutup di modal Transaksi (PM 10 Okt
 * 2026: "masukin aja, jangan double" — menggantikan `OrderDetailModal` yang
 * bertumpuk di atas modal Transaksi).
 *
 * `GET /api/v1/orders/{id}` BARU ditarik saat seksi dibuka, bukan saat modal
 * dibuka: rincian redeem memuat nomor rekening penuh (un-mask USDX-270), jadi
 * membuka modal saja tidak boleh terhitung membuka data rekening. Isinya tidak
 * dirender sama sekali selama tertutup. State buka/tutup dipegang pemanggil
 * supaya bisa ditutup lagi SAAT RENDER ketika baris berganti (↑/↓).
 */
export default function OrderDetailSection({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = useOrderDetail(open ? orderId : null)
  const isiId = useId()
  const detail = query.data?.data

  return (
    <section className="min-w-0" data-testid="order-detail-section" data-state={open ? 'open' : 'closed'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={isiId}
        onClick={() => onOpenChange(!open)}
        className="mb-1 flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
              aria-hidden="true"
            />
            <span className="text-section text-foreground">Rincian order</span>
          </span>
          <span className="mt-0.5 block pl-5 text-xs text-muted-foreground">
            Biaya, spread, perkiraan pendapatan, pembayaran, dan rekening tujuan. Dimuat saat dibuka.
          </span>
        </span>
        <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{open ? 'Tutup' : 'Buka'}</span>
      </button>
      <div id={isiId} className="border-t border-border">
        {open &&
          (query.isError && !detail ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" role="alert">
              <p className="text-sm text-destructive">{errorMessage(query.error, 'Rincian order gagal dimuat.')}</p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
                Coba lagi
              </Button>
            </div>
          ) : !detail ? (
            <div className="space-y-3 py-3" aria-busy="true">
              <span className="sr-only">Memuat rincian order…</span>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="pt-4">
              <OrderDetailContent detail={detail} />
            </div>
          ))}
      </div>
    </section>
  )
}
