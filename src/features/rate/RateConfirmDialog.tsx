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
import { formatRate, formatSpreadPct } from '@/lib/format'
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
    bniBuyRate: string
    /** Angka sama, dicek ulang di wondr → dikirim ulang, jam diperbarui. */
    bniReconfirmed?: boolean
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
  const clearsBni = current?.bniBuyRate != null && next.bniBuyRate.trim() === ''
  // Esc / outside-click disabled while mutating, matching modal convention.
  function handleOpenChange(o: boolean) {
    if (isPending) return
    onOpenChange(o)
  }

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
          <DiffRow
            label="Mode"
            from={current?.mode ?? '—'}
            to={next.mode}
          />
          <DiffRow
            label="Kurs dasar"
            from={current ? formatRate(current.baseRate) : '—'}
            to={
              next.mode === 'MANUAL' && next.manualRate
                ? formatRate(next.manualRate)
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
            label="Kurs BNI"
            from={bniLabel(current?.bniBuyRate)}
            to={bniLabel(next.bniBuyRate.trim() || null, current?.bniBuyRate)}
          />
          <DiffRow
            label="Markup VA"
            from={current?.gatewayMarkupPct != null ? formatSpreadPct(current.gatewayMarkupPct) : '—'}
            to={formatSpreadPct(next.gatewayMarkupPct.trim() || '0')}
          />
          {next.bniReconfirmed && (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm">
              Kurs BNI tidak berubah, tapi sudah dicek ulang di wondr — jam pembaruannya akan diperbarui.
            </p>
          )}
          {clearsBni && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/[0.04] px-3 py-2.5 text-sm">
              Kurs BNI dikosongkan: metode Transfer BNI berhenti ditawarkan ke nasabah di web dan aplikasi.
            </p>
          )}
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

/** Kurs BNI untuk baris pembanding. Angka sama dengan sekarang ditulis sama persis (baris tidak dicoret). */
function bniLabel(value: string | null | undefined, current?: string | null): string {
  if (value === undefined) return '—'
  if (value === null || value === '') return 'belum diisi'
  if (current != null && Number(current) === Number(value)) return formatRate(current)
  return formatRate(value)
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
