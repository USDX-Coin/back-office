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
          <DialogTitle>Record this entry to the public reserve?</DialogTitle>
          <DialogDescription>
            This entry changes the reserve figure shown on the public
            transparency page at usdx.co.id straight away. There is no draft and
            no review step.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {entry ? (
            <>
              <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Cannot be edited or deleted
                </p>
                <p className="mt-1 text-sm text-foreground">
                  The ledger is append-only. If this is wrong, the only fix is to
                  record another entry with the opposite amount — the mistake
                  stays visible in the history.
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                <Row label="Type" value={entry.entryType} />
                <Row
                  label="Amount"
                  ariaLabel="Amount to record"
                  value={`${formatAmountDecimal(entry.amount)} ${entry.currency}`}
                  emphasis={negative ? 'negative' : 'default'}
                />
                <Row label="Event date" value={formatOccurredAt(entry.occurredAt)} />
                <Row
                  label="New balance"
                  ariaLabel="New reserve balance"
                  value={
                    projected
                      ? `${formatAmountDecimal(projected)} ${balance?.currency ?? entry.currency}`
                      : 'Unavailable — current balance not loaded'
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
                    The current reserve balance could not be loaded.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Recording is blocked until it is known — without it there is
                    no way to tell what this entry does to the figure published
                    on usdx.co.id.
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
                      {reloading ? 'Loading balance…' : 'Reload balance'}
                    </Button>
                  )}
                </div>
              )}

              {/* After a non-422 failure the ledger is re-read before a retry is
                  allowed: a 504 can hide a request that DID write its row, and
                  the balance is the only thing that says which happened. */}
              {recheck !== 'idle' && (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/30 px-4 py-3"
                >
                  {recheck === 'checking' ? (
                    <p className="text-sm text-muted-foreground">
                      Re-checking the reserve balance…
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        Balance re-read after the error
                      </p>
                      <p
                        aria-label="Rechecked reserve balance"
                        className="mt-1 font-mono text-sm font-semibold text-foreground"
                      >
                        {balanceKnown
                          ? `${formatAmountDecimal(balance.amount)} ${balance.currency}`
                          : 'Still unavailable'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        If this already includes the entry, it was recorded
                        despite the error — close this dialog instead of trying
                        again.
                      </p>
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
                    This entry was NOT recorded — its key belongs to a different
                    entry
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    An earlier attempt used the same key for an entry whose
                    details differ from the ones above, so this request was
                    rejected and nothing changed. That earlier entry is
                    untouched. Compare the balance above with what you expect: if
                    it already reflects what you meant to record, close this
                    dialog.
                  </p>
                  {onRecordWithNewKey && (
                    <>
                      <p className="mt-2 text-sm text-muted-foreground">
                        If this really is a different entry, record it under a new
                        key. The ledger is append-only, so it is ADDED next to the
                        earlier one — it does not replace or correct it.
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
                        Record as a new entry
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-md border border-border px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Reason (internal — not shown publicly)
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {entry.reason}
                </p>
              </div>

              <FieldError message={error ?? undefined} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No entry to record.</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
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
            {isPending ? 'Recording…' : 'Yes, record entry'}
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
    <div className="grid grid-cols-[104px_1fr] items-baseline gap-3">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
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
