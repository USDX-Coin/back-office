import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
import FieldError from '@/components/FieldError'
import {
  addAmounts,
  formatAmountDecimal,
  formatOccurredAt,
  isNegativeAmount,
  parseAmountToCents,
} from '@/lib/transparency'
import type { CreateLedgerEntryInput, ReserveBalance } from '@/lib/types'

/**
 * Where the balance stands relative to the last failed attempt.
 *   idle     — no failure yet, the balance on screen is simply the current one
 *   checking — a non-422 failure happened and the balance is being re-read
 *   checked  — the balance below was read AFTER the failure
 */
export type BalanceRecheckState = 'idle' | 'checking' | 'checked'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: CreateLedgerEntryInput | null
  /** Current whole-ledger balance, used to project what the public will see. */
  balance: ReserveBalance | undefined
  onConfirm: () => void
  isPending: boolean
  error?: string | null
  recheck?: BalanceRecheckState
  /** Re-reads the ledger so an unknown balance can be resolved from here. */
  onReloadBalance?: () => Promise<unknown>
  /**
   * The last attempt came back `409 LEDGER_IDEMPOTENCY_KEY_CONFLICT`: the key
   * is already on an entry with different content, so nothing was written and
   * pressing confirm again would only repeat the same 409.
   */
  conflict?: boolean
  /** Re-files this same entry under a NEW key — the only way out of a 409. */
  onRecordWithNewKey?: () => void | Promise<unknown>
}

/**
 * The last stop before a number changes on the public website.
 *
 * The ledger has no draft state and no undo, so this dialog has to carry the
 * whole weight of "are you sure": it names the public site, restates the amount
 * being filed, shows the balance that will result, and says plainly that the
 * only way back is another entry. The request is fired from here — never from
 * the form's submit handler — so that dismissing this dialog is guaranteed to
 * leave the ledger untouched.
 */
export default function LedgerConfirmDialog({
  open,
  onOpenChange,
  entry,
  balance,
  onConfirm,
  isPending,
  error,
  recheck = 'idle',
  onReloadBalance,
  conflict = false,
  onRecordWithNewKey,
}: Props) {
  const [reloading, setReloading] = useState(false)

  // Esc / outside-click disabled while the request is in flight, matching the
  // repo's modal convention — a half-sent entry must not lose its dialog.
  function handleOpenChange(next: boolean) {
    if (isPending) return
    onOpenChange(next)
  }

  async function handleReload() {
    if (!onReloadBalance || reloading) return
    setReloading(true)
    try {
      await onReloadBalance()
    } finally {
      setReloading(false)
    }
  }

  const negative = entry ? isNegativeAmount(entry.amount) : false
  // Exact decimal addition (BigInt cents) — never float arithmetic on money.
  const projected =
    entry && balance ? addAmounts(balance.amount, entry.amount) : null
  // The current balance is only "known" if the server actually handed one over
  // AND it parses. `balance === undefined` means the ledger query failed or has
  // not landed — not that the reserve is zero.
  const balanceKnown =
    balance !== undefined && parseAmountToCents(balance.amount) !== null
  const busy = isPending || reloading || recheck === 'checking'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Catat entri ini ke cadangan publik?</DialogTitle>
          <DialogDescription>
            Angka cadangan publik akan berubah saat itu juga di halaman
            transparansi usdx.co.id. Tidak ada draf dan tidak ada tahap
            peninjauan setelah ini.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {entry ? (
            <>
              <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Tidak bisa diubah atau dihapus
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Buku besar hanya bisa ditambah. Kalau entri ini salah,
                  satu-satunya perbaikan adalah mencatat entri baru dengan
                  nominal berlawanan — kekeliruannya tetap terbaca di riwayat.
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                <Row label="Jenis" value={entry.entryType} />
                <Row
                  label="Nominal"
                  ariaLabel="Nominal yang dicatat"
                  value={`${formatAmountDecimal(entry.amount)} ${entry.currency}`}
                  emphasis={negative ? 'negative' : 'default'}
                />
                <Row label="Tanggal kejadian" value={formatOccurredAt(entry.occurredAt)} />
                <Row
                  label="Saldo baru"
                  ariaLabel="Saldo cadangan baru"
                  value={
                    projected
                      ? `${formatAmountDecimal(projected)} ${balance?.currency ?? entry.currency}`
                      : 'Tidak tersedia — saldo sekarang belum termuat'
                  }
                  emphasis="strong"
                />
              </dl>

              {/* Recording with no idea of the running balance is exactly
                  backwards. A CORRECTION is the entry most likely to be filed
                  here, and a correction is meaningless without the figure it is
                  correcting: -1,250.75 against 51k is routine, against 900 it
                  puts the public reserve underwater. So the commit is blocked
                  rather than merely annotated. */}
              {!balanceKnown && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    Saldo cadangan saat ini gagal dimuat.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pencatatan ditahan sampai saldonya terbaca — tanpa angka itu
                    tidak ada cara tahu entri ini mengubah angka publik di
                    usdx.co.id jadi berapa.
                  </p>
                  {onReloadBalance && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleReload}
                      disabled={reloading}
                      aria-busy={reloading}
                    >
                      {reloading ? 'Memuat saldo…' : 'Muat ulang saldo'}
                    </Button>
                  )}
                </div>
              )}

              {/* After a non-422 failure the ledger is re-read before a retry is
                  allowed: a 504 can hide a request that DID write its row, and
                  the balance is the only thing that says which happened.

                  A 409 re-reads the balance too, but it means the OPPOSITE: the
                  backend wrote nothing, and the figure below moved because of
                  the OTHER entry that owns this key — the mistyped one. So the
                  504 wording ("entrinya tercatat meski galat muncul — tutup
                  dialog ini") is gated behind `!conflict`. Left ungated it told the
                  operator to walk away from a 409 with the wrong number left
                  standing as the public reserve and the correction never
                  filed. The heading changes with it, so the number is never
                  read as this entry's doing. */}
              {recheck !== 'idle' && (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/30 px-4 py-3"
                >
                  {recheck === 'checking' ? (
                    <p className="text-sm text-muted-foreground">
                      Memeriksa ulang saldo cadangan…
                    </p>
                  ) : (
                    <>
                      <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                        {conflict
                          ? 'Saldo setelah entri LAIN yang memakai kunci ini'
                          : 'Saldo dibaca ulang setelah galat'}
                      </p>
                      <p
                        aria-label="Saldo cadangan hasil baca ulang"
                        className="mt-1 font-mono text-sm font-semibold text-foreground"
                      >
                        {balanceKnown
                          ? `${formatAmountDecimal(balance.amount)} ${balance.currency}`
                          : 'Masih belum terbaca'}
                      </p>
                      {conflict ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Angka ini TIDAK memuat entri di atas — tidak ada satu
                          pun yang tertulis dari percobaan ini. Ini saldo
                          cadangan yang ditinggalkan entri lain, entri yang sudah
                          memakai kunci tersebut.
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Kalau angka ini sudah memuat entri tadi, berarti
                          entrinya tercatat meski galat muncul — tutup dialog
                          ini, jangan coba lagi.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 409 LEDGER_IDEMPOTENCY_KEY_CONFLICT. Not a success, and not
                  an error to shrug at: the key belongs to an entry that says
                  something ELSE, which is what happens when a timeout is
                  followed by a correction. Nothing was written this time, so
                  the operator has to decide between two live possibilities —
                  the other entry is the one they meant (close), or this is a
                  genuinely different entry (record it under a new key). The
                  balance panel above is what tells them which. */}
              {conflict && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    Entri ini TIDAK tercatat — kuncinya sudah dipakai entri lain
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Percobaan sebelumnya memakai kunci yang sama untuk entri
                    yang isinya berbeda dari rincian di atas, jadi permintaan ini
                    ditolak dan tidak ada yang berubah. Entri lama itu tetap
                    utuh. Bandingkan saldo di atas dengan angka yang seharusnya:
                    kalau sudah sesuai dengan yang dimaksud, tutup dialog ini.
                  </p>
                  {onRecordWithNewKey && (
                    <>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Kalau ini memang entri yang berbeda, catat dengan kunci
                        baru. Buku besar hanya bisa ditambah, jadi entrinya
                        DITAMBAHKAN di samping entri lama — bukan menggantikan
                        dan bukan mengoreksinya.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void onRecordWithNewKey()}
                        disabled={busy || !balanceKnown}
                        aria-busy={isPending}
                      >
                        Catat sebagai entri baru
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-md border border-border px-4 py-3">
                <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Alasan (internal — tidak tampil di publik)
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {entry.reason}
                </p>
              </div>

              <FieldError message={error ?? undefined} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada entri untuk dicatat.</p>
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
            // Locked while a conflict stands: this button re-sends the SAME
            // key, and the backend can only answer it with the same 409. The
            // way forward is the new-key action in the alert above, or Cancel.
            disabled={busy || !entry || !balanceKnown || conflict}
            aria-busy={isPending}
          >
            {isPending ? 'Mencatat…' : 'Ya, catat entri'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  value,
  ariaLabel,
  emphasis = 'default',
}: {
  label: string
  value: string
  ariaLabel?: string
  emphasis?: 'default' | 'strong' | 'negative'
}) {
  return (
    <div className="grid grid-cols-[128px_1fr] items-baseline gap-3">
      <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd
        aria-label={ariaLabel}
        className={
          emphasis === 'negative'
            ? 'font-mono font-semibold text-destructive'
            : emphasis === 'strong'
              ? 'font-mono font-semibold text-foreground'
              : 'font-mono text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  )
}
