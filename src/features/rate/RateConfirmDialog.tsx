import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRate, formatSpreadPct, rateModeLabel } from '@/lib/format'
import type { RateInfo, RateMode } from '@/lib/types'

export interface RateConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: RateInfo | undefined
  next: {
    mode: RateMode
    manualRate: string
    spreadBuyPct: string
    spreadSellPct: string
    gatewayMarkupPct: string
    /** D28 — X; kosong = tidak dikirim = X aktif dibawa. */
    bniRateMaxDeviationPct: string
  }
  onConfirm: () => void
  isPending: boolean
}

// Confirmation modal showing current → new diff before submit. Required
// because rate updates are append-only and immediately active for every
// downstream mint/burn — see docs/notes/usdx-20-decisions.md § 3.
export default function RateConfirmDialog({
  open,
  onOpenChange,
  current,
  next,
  onConfirm,
  isPending,
}: RateConfirmDialogProps) {
  // Esc / outside-click disabled while mutating, matching modal convention.
  function handleOpenChange(o: boolean) {
    if (isPending) return
    onOpenChange(o)
  }

  // D28-d: Y dan kedua spread TIDAK ikut berubah saat pindah mode, padahal kurs
  // BNI sudah memuat spread bank — staf diingatkan mengkalibrasinya.
  const switchingToBni = next.mode === 'BNI' && current?.mode !== 'BNI'
  const nextDeviation = next.bniRateMaxDeviationPct.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Ubah kurs yang berlaku?</DialogTitle>
          <DialogDescription>
            Kurs baru langsung dipakai untuk semua order mint dan redeem
            berikutnya — ini harga yang dibayar setiap nasabah mulai detik
            tombol ini ditekan. Order yang sudah memilih metode bayar tetap
            memakai kurs lamanya.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {switchingToBni && (
            <div
              role="note"
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
              data-testid="rate-bni-calibration-reminder"
            >
              <p className="font-medium">Sudah kalibrasi markup dan spread terhadap kurs BNI?</p>
              <p className="mt-1 text-muted-foreground">
                Kurs BNI sudah memuat spread bank. Markup Virtual Account (Y), spread beli, dan spread
                jual tidak berubah otomatis saat pindah mode — pastikan angkanya sudah disesuaikan.
                Pindah ke mode BNI hanya berhasil kalau kurs BNI bisa diambil saat ini dan lolos
                pengaman pergeseran dengan batas X di form ini.
              </p>
            </div>
          )}
          <DiffRow
            label="Mode"
            from={current ? rateModeLabel(current.mode) : '—'}
            to={rateModeLabel(next.mode)}
          />
          <DiffRow
            label="Kurs dasar"
            from={current ? formatRate(current.baseRate) : '—'}
            to={
              next.mode === 'MANUAL' && next.manualRate
                ? formatRate(next.manualRate)
                : next.mode === 'BNI'
                  ? 'otomatis (kurs BNI)'
                  : 'otomatis (kurs pasar)'
            }
          />
          <DiffRow
            label="Spread beli"
            from={current ? formatSpreadPct(current.spreadBuyPct) : '—'}
            to={formatSpreadPct(next.spreadBuyPct || '0')}
          />
          <DiffRow
            label="Spread jual"
            from={current ? formatSpreadPct(current.spreadSellPct) : '—'}
            to={formatSpreadPct(next.spreadSellPct || '0')}
          />
          <DiffRow
            label="Markup VA"
            from={current?.gatewayMarkupPct != null ? formatSpreadPct(current.gatewayMarkupPct) : '—'}
            to={formatSpreadPct(next.gatewayMarkupPct.trim() || '0')}
          />
          <DiffRow
            label="Batas X"
            from={current?.bniRateMaxDeviationPct != null ? formatSpreadPct(current.bniRateMaxDeviationPct) : '—'}
            // Kosong = tidak dikirim = X aktif tetap (tidak tampil sebagai perubahan).
            to={
              nextDeviation
                ? formatSpreadPct(nextDeviation)
                : current?.bniRateMaxDeviationPct != null
                  ? formatSpreadPct(current.bniRateMaxDeviationPct)
                  : '—'
            }
          />
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Menyimpan…' : 'Ya, ubah kurs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DiffRow({ label, from, to }: { label: string; from: string; to: string }) {
  const changed = from !== to
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-3 text-sm">
      <span className="text-xs text-muted-foreground">
        {label}
      </span>
      <div className="tabular-nums flex flex-wrap items-baseline gap-2">
        <span className={changed ? 'text-muted-foreground line-through' : ''}>
          {from}
        </span>
        {changed && (
          <>
            <span aria-hidden className="text-muted-foreground">→</span>
            <span className="font-semibold text-foreground">{to}</span>
          </>
        )}
      </div>
    </div>
  )
}
