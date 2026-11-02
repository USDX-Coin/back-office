import { useRef, useState } from 'react'
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
  buildMintSwapResolveBody,
  formatIdrOrDash,
  formatUsdDifference,
  MINT_SWAP_ACTION_LABELS,
  MINT_SWAP_EXTERNAL_REF_MAX,
  MINT_SWAP_REASON_MAX,
  mintSwapErrorMessage,
  normalizeCreditedUsd,
  type MintSwapResolveErrors,
} from '@/lib/mintSwaps'
import { formatUsdxExact } from '@/lib/redeemApprovals'
import type { MintSwapAction, MintSwapDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useResolveMintSwap } from './hooks'

interface Props {
  detail: MintSwapDetail
  action: MintSwapAction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fokus setelah dialog ditutup bila tombol pemicunya sudah tidak ada. */
  fallbackFocus?: () => HTMLElement | null
}

const TITLES: Record<MintSwapAction, string> = {
  RETRY: 'Coba lagi swap ini?',
  SETTLED_MANUAL: 'Nyatakan sudah ditukar manual?',
  CLOSED: 'Tutup swap tanpa ditukar?',
}

/** Selisih USD dari isian (sen → BigInt, tanpa Number) untuk pratinjau. */
function previewDifference(creditedUsd: string, amountUsdx: string): string | null {
  const credited = normalizeCreditedUsd(creditedUsd)
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amountUsdx.trim())
  if (!credited || !m) return null
  const scale = (whole: string, frac: string) => BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6))
  const [cw, cf = ''] = credited.split('.')
  const diff = scale(cw!, cf) - scale(m[1]!, m[2] ?? '')
  const neg = diff < 0n
  const abs = neg ? -diff : diff
  const raw = `${neg ? '-' : ''}${abs / 1_000_000n}.${(abs % 1_000_000n).toString().padStart(6, '0')}`
  return formatUsdDifference(raw)
}

/** Dampak aksi, ditulis sebagai yang AKAN terjadi (§ 21.6 UX). */
function Impact({ action, detail }: { action: MintSwapAction; detail: MintSwapDetail }) {
  const usdx = formatUsdxExact(detail.amountUsdx)
  if (action === 'RETRY') {
    return (
      <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm" data-testid="resolve-impact">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Swap kembali ke antrean dan dikirim ulang ke BNI dengan kunci baru. Batas waktu 30 menit dihitung ulang dari
          sekarang. Kalau berhasil, order dilanjutkan ke mint <strong>{usdx}</strong>. Swap keluar dari antrean Swap
          Bermasalah.
        </span>
      </p>
    )
  }
  if (action === 'SETTLED_MANUAL') {
    return (
      <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm" data-testid="resolve-impact">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Ini <strong>usulan</strong>, belum berlaku. Setelah disetujui orang kedua, swap dianggap sudah ditukar manual
          oleh treasury dan order akan dilanjutkan ke mint <strong>{usdx}</strong>. Sampai disetujui, swap tetap di
          antrean. Tidak ada transfer yang dibuat dari sini.
        </span>
      </p>
    )
  }
  return (
    <p
      className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      data-testid="resolve-impact"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Swap <strong>tidak akan ditukar</strong> dan order menjadi gagal — <strong>{usdx} tidak dicetak</strong>. Rupiah{' '}
        {formatIdrOrDash(detail.order.totalPayIdr)} dikembalikan ke nasabah secara manual oleh treasury; tidak ada
        refund otomatis dan nasabah tidak diberi tahu otomatis.
      </span>
    </p>
  )
}

/**
 * D29 — dialog resolve satu swap bermasalah (`POST …/resolve`, § 21.6).
 *
 * Tombol kirim MATI sampai isian sah (alasan ≥ 10 karakter selain spasi; referensi
 * BNI + dolar diterima pada `SETTLED_MANUAL`). Galat server tampil DI DALAM dialog;
 * 409 keadaan-berubah juga menarik ulang data (hook). `202` = usulan maker-checker.
 */
export default function ResolveMintSwapDialog({ detail, action, open, onOpenChange, fallbackFocus }: Props) {
  const resolve = useResolveMintSwap()
  const [reason, setReason] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [creditedUsd, setCreditedUsd] = useState('')
  const [touched, setTouched] = useState<MintSwapResolveErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const succeeded = useRef(false)

  // Isian dikosongkan SAAT RENDER ketika swap atau aksinya berganti — alasan yang
  // tertinggal dari pilihan sebelumnya akan masuk jejak append-only swap ini.
  const key = `${detail.id}:${action ?? ''}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setReason('')
    setExternalRef('')
    setCreditedUsd('')
    setTouched({})
    setServerError(null)
  }

  if (!action) return null

  const pending = resolve.isPending
  const check = buildMintSwapResolveBody({ action, reason, externalRef, creditedUsd })
  const errors: MintSwapResolveErrors = check.valid ? {} : check.errors
  const diff = action === 'SETTLED_MANUAL' ? previewDifference(creditedUsd, detail.amountUsdx) : null

  function submit() {
    if (!action) return
    if (!check.valid) {
      setTouched({ reason: 'x', externalRef: 'x', creditedUsd: 'x' })
      return
    }
    setServerError(null)
    resolve.mutate(
      { id: detail.id, input: { action, reason, externalRef, creditedUsd } },
      {
        onSuccess: (result) => {
          if (result && 'approvalRequestId' in result) {
            toast.success('Usulan tercatat — menunggu persetujuan orang kedua', {
              description: 'Swap tetap di antrean Swap Bermasalah sampai disetujui.',
            })
          } else {
            toast.success(action === 'RETRY' ? 'Swap dikembalikan ke antrean pengiriman' : 'Swap ditutup', {
              description: 'Swap keluar dari antrean Swap Bermasalah; riwayatnya tetap terbaca di detail.',
            })
          }
          succeeded.current = true
          onOpenChange(false)
        },
        onError: (err) => setServerError(mintSwapErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="max-w-xl bg-card"
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        onCloseAutoFocus={(e) => {
          // Setelah aksi BERHASIL tombol pemicunya hilang (allowedActions berubah),
          // jadi fokus ke kotak status modal, bukan ke tombol yang akan lenyap.
          // Batal = bawaan Radix (kembali ke tombol pemicu).
          if (!succeeded.current) return
          succeeded.current = false
          const el = fallbackFocus?.()
          if (el) {
            e.preventDefault()
            el.focus()
          }
        }}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{TITLES[action]}</DialogTitle>
            <DialogDescription>
              {detail.customerName ?? 'Nasabah tanpa nama'} · {formatUsdxExact(detail.amountUsdx)} ·{' '}
              {formatIdrOrDash(detail.plannedIdr)}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <Impact action={action} detail={detail} />

              {action === 'SETTLED_MANUAL' && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="swap-external-ref" className="text-xs font-medium">
                      Nomor referensi BNI swap manual <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="swap-external-ref"
                      value={externalRef}
                      onChange={(e) => setExternalRef(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, externalRef: 'x' }))}
                      maxLength={MINT_SWAP_EXTERNAL_REF_MAX}
                      aria-invalid={Boolean(touched.externalRef && errors.externalRef)}
                      disabled={pending}
                    />
                    <FieldError message={touched.externalRef ? errors.externalRef ?? '' : ''} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="swap-credited-usd" className="text-xs font-medium">
                      Dolar yang diterima (USD) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="swap-credited-usd"
                      inputMode="decimal"
                      value={creditedUsd}
                      onChange={(e) => setCreditedUsd(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, creditedUsd: 'x' }))}
                      aria-invalid={Boolean(touched.creditedUsd && errors.creditedUsd)}
                      aria-describedby="swap-credited-usd-hint"
                      className="tabular-nums"
                      disabled={pending}
                      placeholder="contoh 1000.50"
                    />
                    <p id="swap-credited-usd-hint" className="text-xs text-muted-foreground">
                      Order butuh {formatUsdxExact(detail.amountUsdx)}.
                      {diff ? ` Isian ini: ${diff}.` : ''}
                    </p>
                    <FieldError message={touched.creditedUsd ? errors.creditedUsd ?? '' : ''} />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label htmlFor="swap-reason" className="text-xs font-medium">
                  Alasan <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="swap-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, reason: 'x' }))}
                  maxLength={MINT_SWAP_REASON_MAX}
                  rows={3}
                  aria-invalid={Boolean(touched.reason && errors.reason)}
                  disabled={pending}
                  placeholder="Tulis apa yang terjadi dan dasar keputusannya — masuk jejak audit yang tidak bisa diubah"
                />
                <div className="flex items-baseline justify-between gap-2">
                  <FieldError message={touched.reason ? errors.reason ?? '' : ''} />
                  <span
                    className={cn(
                      'ml-auto text-xs tabular-nums',
                      reason.length >= MINT_SWAP_REASON_MAX ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {reason.length}/{MINT_SWAP_REASON_MAX}
                  </span>
                </div>
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{serverError}</span>
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              type="submit"
              variant={action === 'CLOSED' ? 'destructive' : 'default'}
              disabled={pending || !check.valid}
              aria-busy={pending}
            >
              {pending
                ? 'Menyimpan…'
                : action === 'SETTLED_MANUAL'
                  ? 'Kirim usulan'
                  : MINT_SWAP_ACTION_LABELS[action]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
