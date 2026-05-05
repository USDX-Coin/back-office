import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    spreadPct: string
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm rate update</DialogTitle>
          <DialogDescription>
            This change becomes active immediately and is applied to every
            subsequent mint and redeem transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <DiffRow
            label="Mode"
            from={current?.mode ?? '—'}
            to={next.mode}
          />
          <DiffRow
            label="Rate"
            from={current ? formatRate(current.rate) : '—'}
            to={
              next.mode === 'MANUAL' && next.manualRate
                ? formatRate(next.manualRate)
                : 'auto (DYNAMIC feed)'
            }
          />
          <DiffRow
            label="Spread"
            from={current ? formatSpreadPct(current.spreadPct) : '—'}
            to={formatSpreadPct(next.spreadPct || '0')}
          />
        </div>

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
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Updating…' : 'Yes, update rate'}
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
      <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-baseline gap-2 font-mono">
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
