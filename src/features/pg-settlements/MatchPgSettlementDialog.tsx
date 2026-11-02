import { useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import { formatDateTime, formatIsoDayLong } from '@/lib/format'
import { formatIdrDifference, PG_REASON_MAX, pgSettlementErrorMessage, validatePgReason } from '@/lib/pgSettlements'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PgSettlementBatchDetail } from '@/lib/types'
import { useMatchPgSettlement } from './hooks'

/** Selisih kredit terpilih − diharapkan (sen BigInt) → kalimat. */
function differenceFor(amountIdr: string, expectedIdr: string): string | null {
  const cents = (v: string) => {
    const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(v.trim())
    if (!m) return null
    const c = BigInt(m[2]!) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'))
    return m[1] ? -c : c
  }
  const a = cents(amountIdr)
  const e = cents(expectedIdr)
  if (a === null || e === null) return null
  const d = a - e
  const abs = d < 0n ? -d : d
  return formatIdrDifference(`${d < 0n ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`)
}

/**
 * D29 — tautkan batch `MISMATCH` ke satu kredit mutasi (`POST …/match-manual`).
 * Pilih tepat satu kandidat (radio, papan ketik ↑/↓), alasan ≥ 10 karakter WAJIB;
 * tombol mati sampai sah. 409 (`BATCH_NOT_MISMATCH`, `CREDIT_ALREADY_LINKED`)
 * tampil di dialog dan data dimuat ulang.
 */
export default function MatchPgSettlementDialog({
  detail,
  open,
  onOpenChange,
  fallbackFocus,
}: {
  detail: PgSettlementBatchDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  fallbackFocus?: () => HTMLElement | null
}) {
  const match = useMatchPgSettlement()
  const [entryId, setEntryId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const succeeded = useRef(false)

  const [lastKey, setLastKey] = useState(`${detail.id}:${open}`)
  if (`${detail.id}:${open}` !== lastKey) {
    setLastKey(`${detail.id}:${open}`)
    setEntryId(null)
    setReason('')
    setTouched(false)
    setServerError(null)
  }

  const candidates = detail.candidateCredits ?? []
  const chosen = candidates.find((c) => c.entryId === entryId)
  const why = validatePgReason(reason)
  const valid = Boolean(chosen) && !why.error
  const pending = match.isPending

  function submit() {
    setTouched(true)
    if (!valid || !entryId) return
    setServerError(null)
    match.mutate(
      { id: detail.id, body: { creditEntryId: entryId, reason } },
      {
        onSuccess: () => {
          toast.success('Batch ditautkan manual', { description: 'Untung order di dalamnya sekarang final.' })
          succeeded.current = true
          onOpenChange(false)
        },
        onError: (err) => setServerError(pgSettlementErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="max-w-xl bg-card"
        onCloseAutoFocus={(e) => {
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
            <DialogTitle>Tautkan batch secara manual?</DialogTitle>
            <DialogDescription>
              Batch {formatIsoDayLong(detail.businessDate)} · diharapkan {formatIdrExact(detail.expectedIdr)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada kandidat kredit. Cek pola pengirim di Pengaturan → Payment Gateway atau tunggu kredit Durianpay masuk.
              </p>
            ) : (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium">
                  Kredit mutasi NP IDR <span className="text-destructive">*</span>
                </legend>
                {candidates.map((c) => (
                  <label
                    key={c.entryId}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/55"
                  >
                    <input
                      type="radio"
                      name="pg-credit"
                      value={c.entryId}
                      checked={entryId === c.entryId}
                      onChange={() => setEntryId(c.entryId)}
                      disabled={pending}
                      className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0">
                      <span className="font-medium tabular-nums">{formatIdrExact(c.amountIdr)}</span>
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">{formatDateTime(c.bookedAt)} WIB</span>
                      <span className="block break-words text-xs text-muted-foreground">{c.description}</span>
                      <span className="block text-xs">Selisih {differenceFor(c.amountIdr, detail.expectedIdr) ?? '—'}</span>
                    </span>
                  </label>
                ))}
                <FieldError message={touched && !chosen ? 'Pilih satu kredit.' : ''} />
              </fieldset>
            )}

            {chosen && (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-sm" data-testid="match-impact">
                Batch {formatIsoDayLong(detail.businessDate)} ditandai <strong>cocok manual</strong> dengan kredit{' '}
                <strong>{formatIdrExact(chosen.amountIdr)}</strong>. Untung {detail.orderCount} order di dalamnya menjadi
                final. Selisih {differenceFor(chosen.amountIdr, detail.expectedIdr) ?? '—'} tetap tercatat; keputusan ini
                masuk jejak audit bersama alasanmu.
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="pg-match-reason" className="text-xs font-medium">
                Alasan <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="pg-match-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={PG_REASON_MAX}
                rows={3}
                disabled={pending}
                aria-invalid={Boolean(touched && why.error)}
                placeholder="Misalnya: sudah dicek di dashboard Durianpay, selisih karena …"
              />
              <FieldError message={touched ? (why.error ?? '') : ''} />
            </div>

            {serverError && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{serverError}</span>
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending || !valid} aria-busy={pending}>
              {pending ? 'Menyimpan…' : 'Tautkan manual'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
