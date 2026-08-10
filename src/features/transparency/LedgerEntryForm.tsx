import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import {
  isLedgerErrorCode,
  LEDGER_ERROR_FIELD,
  LEDGER_REASON_MIN_LEN,
  validateLedgerEntryForm,
} from '@/lib/validators'
import {
  LEDGER_ENTRY_TYPES_SELECTABLE,
  LEDGER_SUPPORTED_CURRENCY,
  type CreateLedgerEntryInput,
  type ReserveBalance,
  type SelectableLedgerEntryType,
} from '@/lib/types'
import { wibToday } from '@/lib/transparency'
import { useCreateLedgerEntry } from './hooks'
import LedgerConfirmDialog from './LedgerConfirmDialog'

interface Props {
  /** Current whole-ledger balance, passed to the dialog to project the result. */
  balance: ReserveBalance | undefined
}

const ENTRY_TYPE_HINTS: Record<SelectableLedgerEntryType, string> = {
  SEED: 'First recording of a reserve that already exists.',
  ADJUSTMENT: 'Any later change, including corrections (use a negative amount).',
}

const EMPTY_FORM = {
  entryType: '' as SelectableLedgerEntryType | '',
  amount: '',
  reason: '',
  occurredAt: '',
}

/**
 * Records one entry into the append-only reserve ledger.
 *
 * Submitting does NOT call the API. It validates and opens the confirmation
 * dialog, which is what actually fires the request — the entry lands on the
 * public site the instant it is created, so a stray click on a submit button
 * must not be enough to move a published number.
 */
export default function LedgerEntryForm({ balance }: Props) {
  const create = useCreateLedgerEntry()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // A failure the dialog has to keep showing (500, 403, network). Field-level
  // contract errors go into `errors` instead, so a message is never rendered
  // twice. Either way the backend's wording is passed through verbatim — the
  // operator needs to see exactly what the API objected to.
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [pending, setPending] = useState<CreateLedgerEntryInput | null>(null)

  function set<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDialogError(null)
    const validation = validateLedgerEntryForm({
      entryType: form.entryType,
      amount: form.amount,
      currency: LEDGER_SUPPORTED_CURRENCY,
      reason: form.reason,
      occurredAt: form.occurredAt,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    setPending({
      entryType: form.entryType as SelectableLedgerEntryType,
      amount: form.amount.trim(),
      currency: LEDGER_SUPPORTED_CURRENCY,
      reason: form.reason.trim(),
      occurredAt: form.occurredAt.trim(),
    })
  }

  async function handleConfirm() {
    if (!pending) return
    setDialogError(null)
    try {
      await create.mutateAsync(pending)
      toast.success('Ledger entry recorded')
      setPending(null)
      setForm(EMPTY_FORM)
      setErrors({})
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't record the entry. Please try again."

      // A contract validation code names the field that is wrong, so send the
      // operator back to that field with the server's own wording — the entry
      // cannot succeed until they change something. Anything else (500, 403,
      // network) is transient or systemic, so the dialog stays open and a retry
      // does not mean re-confirming from scratch.
      if (err instanceof ApiError && isLedgerErrorCode(err.code)) {
        // Resolved outside the updater so the narrowed code survives — inside
        // the callback TS widens `err.code` back to `string`.
        const field = LEDGER_ERROR_FIELD[err.code]
        setErrors((prev) => ({ ...prev, [field]: message }))
        setPending(null)
      } else {
        setDialogError(message)
      }
      toast.error(message)
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Record a ledger entry
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate id="ledger-entry-form">
        <CardContent className="space-y-5">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Entry type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEDGER_ENTRY_TYPES_SELECTABLE.map((type) => (
                <label
                  key={type}
                  htmlFor={`entryType-${type}`}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    id={`entryType-${type}`}
                    type="radio"
                    name="entryType"
                    value={type}
                    checked={form.entryType === type}
                    onChange={() => set('entryType', type)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-medium">
                      {type}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ENTRY_TYPE_HINTS[type]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError message={errors.entryType} />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="ledgerAmount">Amount</Label>
              <Input
                id="ledgerAmount"
                // `type="text"` on purpose: a negative amount is a first-class
                // input here, and number inputs hide what was actually typed
                // (invalid content reads back as an empty string), which would
                // stop the validator from ever seeing it.
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="1250.00"
                className="font-mono"
                aria-describedby="ledgerAmountHint"
              />
              <p id="ledgerAmountHint" className="text-xs text-muted-foreground">
                Up to 2 decimals. Use a negative amount (e.g. −1250.00) to
                correct an earlier entry. Zero is not allowed.
              </p>
              <FieldError message={errors.amount} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ledgerCurrency">Currency</Label>
              <Input
                id="ledgerCurrency"
                readOnly
                value={LEDGER_SUPPORTED_CURRENCY}
                className="font-mono"
                aria-describedby="ledgerCurrencyHint"
              />
              <p id="ledgerCurrencyHint" className="text-xs text-muted-foreground">
                USD only at this stage.
              </p>
              <FieldError message={errors.currency} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ledgerOccurredAt">Event date</Label>
            <Input
              id="ledgerOccurredAt"
              type="date"
              value={form.occurredAt}
              max={wibToday()}
              onChange={(e) => set('occurredAt', e.target.value)}
              className="font-mono"
              aria-describedby="ledgerOccurredAtHint"
            />
            <p id="ledgerOccurredAtHint" className="text-xs text-muted-foreground">
              When it actually happened in the real world (the bank transfer
              date, for example) — not today's date. Cannot be in the future.
            </p>
            <FieldError message={errors.occurredAt} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ledgerReason">Reason</Label>
            <Textarea
              id="ledgerReason"
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              rows={3}
              placeholder="Setoran giro USD untuk penambahan cadangan"
              aria-describedby="ledgerReasonHint"
            />
            <p id="ledgerReasonHint" className="text-xs text-muted-foreground">
              Required, at least {LEDGER_REASON_MIN_LEN} characters. This is the
              internal record of why the public figure moved — it is kept for
              audit and is never shown on the public page.
            </p>
            <FieldError message={errors.reason} />
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            form="ledger-entry-form"
            disabled={create.isPending}
            aria-busy={create.isPending}
            className="w-full"
          >
            {create.isPending ? 'Recording…' : 'Review and record'}
          </Button>
        </CardFooter>
      </form>

      <LedgerConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
            setDialogError(null)
          }
        }}
        entry={pending}
        balance={balance}
        onConfirm={handleConfirm}
        isPending={create.isPending}
        error={dialogError}
      />
    </Card>
  )
}
