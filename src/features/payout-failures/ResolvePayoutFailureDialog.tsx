import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import {
  buildResolveBody,
  PAYOUT_EXTERNAL_REF_MAX,
  PAYOUT_RESOLVE_REASON_MAX,
  payoutFailureErrorMessage,
  RESOLVE_ACTION_LABELS,
  type ResolveFormErrors,
} from '@/lib/payoutFailures'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PayoutFailureDetail, PayoutResolution } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useResolvePayoutFailure } from './hooks'

interface Props {
  detail: PayoutFailureDetail
  action: PayoutResolution | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES: Record<PayoutResolution, string> = {
  RESENT: 'Kirim ulang payout',
  SETTLED_MANUAL: 'Tandai sudah dibayar manual',
  CLOSED: 'Tutup tanpa pembayaran',
}

/** Akibat tiap aksi (§ 17.5), ditulis sebagai yang AKAN terjadi — bukan nama kolom. */
function Consequence({ action, detail }: { action: PayoutResolution; detail: PayoutFailureDetail }) {
  if (action === 'RESENT') {
    return (
      <div className="space-y-2" data-testid="resolve-consequence">
        <p className="text-[12.5px]">
          Referensi transfer <strong>baru</strong> diterbitkan dan order kembali ke antrean
          pengiriman — <strong>{formatIdrExact(detail.netPayoutIdr)}</strong> dikirim pada
          putaran Disbursement Trigger berikutnya ke rekening ini:
        </p>
        <p className="rounded-md border border-border px-3 py-2 text-[12.5px]">
          {detail.bankName} ·{' '}
          <span className="break-all font-mono tabular-nums">{detail.bankAccountNumber}</span> ·{' '}
          <span className="font-medium">{detail.bankAccountName}</span>
        </p>
        {/* Tidak ada isian nomor rekening di mana pun di layar ini (§ 17.5, D22): satu
            orang yang bisa mengetik tujuan transfer adalah lubang jalur OTC lama. */}
        <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Rekening tujuan tidak bisa diketik di sini. Kalau rekeningnya yang salah, nasabah
            menambahkan rekening yang benar lewat app — kirim ulang ke rekening yang sama hanya
            akan ditolak lagi.
          </span>
        </p>
      </div>
    )
  }
  if (action === 'SETTLED_MANUAL') {
    return (
      <p
        className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-[12.5px]"
        data-testid="resolve-consequence"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Mencatat bahwa <strong>{formatIdrExact(detail.netPayoutIdr)}</strong> SUDAH dikirim
          treasury di luar sistem. Tidak ada transfer yang dibuat dari sini; order menjadi
          selesai. Isi nomor referensi transfer bank sebagai buktinya.
        </span>
      </p>
    )
  }
  return (
    <p
      className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
      data-testid="resolve-consequence"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Order ini <strong>tidak akan dibayar</strong>. USDX nasabah sudah terbakar dan tidak ada
        pengembalian on-chain. Nasabah <strong>tidak</strong> diberi tahu otomatis.
      </span>
    </p>
  )
}

/**
 * USDX-662 — dialog resolve satu order bermasalah (`POST …/resolve`, § 17.5).
 *
 * Tombol simpan MATI sampai isian sah (alasan ≥ 10 karakter; nomor referensi pada
 * `SETTLED_MANUAL`) — tidak ada panggilan yang hanya bisa berakhir `400`. Galat
 * server tampil DI DALAM dialog, bukan sebagai toast yang keburu hilang: `409`
 * di sini selalu berarti ada yang harus ops lakukan (muat ulang, tunggu, pakai aksi
 * lain), dan layar tidak boleh menggantung tanpa mengatakannya.
 */
export default function ResolvePayoutFailureDialog({ detail, action, open, onOpenChange }: Props) {
  const resolve = useResolvePayoutFailure()
  const [reason, setReason] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [touched, setTouched] = useState<ResolveFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Isian dikosongkan SAAT RENDER ketika order atau aksinya berganti — alasan yang
  // tertinggal dari pilihan sebelumnya akan masuk jejak append-only order ini.
  const key = `${detail.id}:${action ?? ''}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setReason('')
    setExternalRef('')
    setTouched({})
    setServerError(null)
  }

  if (!action) return null

  const isPending = resolve.isPending
  const check = buildResolveBody({ action, reason, externalRef })
  const errors: ResolveFormErrors = check.valid ? {} : check.errors

  function handleSubmit() {
    if (!action || !check.valid) {
      setTouched({ reason: 'x', externalRef: 'x' })
      return
    }
    setServerError(null)
    resolve.mutate(
      { id: detail.id, input: { action, reason, externalRef } },
      {
        onSuccess: () => {
          toast.success(`${RESOLVE_ACTION_LABELS[action]} tercatat`, {
            description: 'Order keluar dari antrean terbuka; jejaknya tetap terbaca di detail.',
          })
          onOpenChange(false)
        },
        onError: (err) => setServerError(payoutFailureErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-xl bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{TITLES[action]}</DialogTitle>
          <DialogDescription>
            {detail.bankAccountName} · {formatIdrExact(detail.netPayoutIdr)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Consequence action={action} detail={detail} />

            {action === 'SETTLED_MANUAL' && (
              <div className="space-y-1.5">
                <label htmlFor="resolve-external-ref" className="text-[12.5px] font-medium">
                  Nomor referensi transfer bank <span className="text-destructive">*</span>
                </label>
                <Input
                  id="resolve-external-ref"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, externalRef: 'x' }))}
                  maxLength={PAYOUT_EXTERNAL_REF_MAX}
                  aria-invalid={Boolean(touched.externalRef && errors.externalRef)}
                  disabled={isPending}
                  placeholder="mis. nomor jurnal BNIdirect"
                />
                <FieldError message={touched.externalRef ? errors.externalRef ?? '' : ''} />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="resolve-reason" className="text-[12.5px] font-medium">
                Alasan <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="resolve-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, reason: 'x' }))}
                maxLength={PAYOUT_RESOLVE_REASON_MAX}
                rows={3}
                aria-invalid={Boolean(touched.reason && errors.reason)}
                disabled={isPending}
                placeholder="Tulis APA yang terjadi dan dasar keputusannya — ia masuk jejak audit yang tidak bisa diubah"
              />
              <div className="flex items-baseline justify-between gap-2">
                <FieldError message={touched.reason ? errors.reason ?? '' : ''} />
                <span
                  className={cn(
                    'ml-auto font-mono text-[11px] tabular-nums',
                    reason.length >= PAYOUT_RESOLVE_REASON_MAX ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {reason.length}/{PAYOUT_RESOLVE_REASON_MAX}
                </span>
              </div>
            </div>

            {serverError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{serverError}</span>
              </p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant={action === 'CLOSED' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isPending || !check.valid}
            aria-busy={isPending}
          >
            {isPending ? 'Menyimpan…' : RESOLVE_ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
