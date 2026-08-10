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
} from '@/lib/transparency'
import type { CreateLedgerEntryInput, ReserveBalance } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: CreateLedgerEntryInput | null
  /** Current whole-ledger balance, used to project what the public will see. */
  balance: ReserveBalance | undefined
  onConfirm: () => void
  isPending: boolean
  error?: string | null
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
}: Props) {
  // Esc / outside-click disabled while the request is in flight, matching the
  // repo's modal convention — a half-sent entry must not lose its dialog.
  function handleOpenChange(next: boolean) {
    if (isPending) return
    onOpenChange(next)
  }

  const negative = entry ? isNegativeAmount(entry.amount) : false
  // Exact decimal addition (BigInt cents) — never float arithmetic on money.
  const projected =
    entry && balance ? addAmounts(balance.amount, entry.amount) : null

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
            disabled={isPending || !entry}
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
