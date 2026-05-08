import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRate } from '@/features/rate/hooks'
import { formatIdrAmount, formatUsdxAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AmountCurrency } from '@/lib/types'

// USDX-46 — composite amount field with currency switcher + bidirectional
// conversion preview. Backed by `GET /api/v1/rate` (sot/api/rate.yaml).
//
// Behavior:
// - Default currency = USD (sot/phase-1.md § Backoffice Pages L457-458 says
//   operator picks currency, no default specified — we default to USD because
//   USDX is USD-pegged 1:1).
// - Switching USD ↔ IDR resets the amount field — explicit re-confirmation
//   to avoid magnitude mistakes (1000 USD vs 1000 IDR is a 16,250× difference).
// - Preview is bidirectional: USD input shows IDR equivalent and vice-versa.
// - Rate fetch failure → preview shows "—"; form remains submit-able because
//   BE is the authoritative converter at submission time.

export interface AmountWithCurrencyInputProps {
  amountId?: string
  currencyId?: string
  amount: string
  currency: AmountCurrency
  onAmountChange: (amount: string) => void
  onCurrencyChange: (currency: AmountCurrency) => void
  amountError?: string
  currencyError?: string
  className?: string
  disabled?: boolean
}

const CURRENCIES: { value: AmountCurrency; label: string }[] = [
  { value: 'USD', label: 'USD (USDX 1:1)' },
  { value: 'IDR', label: 'IDR' },
]

export default function AmountWithCurrencyInput({
  amountId,
  currencyId,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  amountError,
  currencyError,
  className,
  disabled,
}: AmountWithCurrencyInputProps) {
  const { data: rate, isError: rateError, isLoading: rateLoading } = useRate()

  const amountNum = Number(amount.trim())
  const rateNum = rate ? Number(rate.rate) : Number.NaN
  const hasValidAmount = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0
  const hasValidRate = Number.isFinite(rateNum) && rateNum > 0

  let preview = '—'
  if (hasValidAmount && hasValidRate) {
    preview =
      currency === 'USD'
        ? `≈ ${formatIdrAmount(amountNum * rateNum)}`
        : `≈ ${formatUsdxAmount(amountNum / rateNum)}`
  } else if (rateLoading) {
    preview = 'Loading rate…'
  } else if (rateError) {
    preview = 'Rate unavailable — backend will compute conversion at submit.'
  }

  function handleCurrencyChange(next: string) {
    if (next !== 'USD' && next !== 'IDR') return
    if (next === currency) return
    onCurrencyChange(next as AmountCurrency)
    onAmountChange('')
  }

  const unitLabel = currency === 'USD' ? 'USD' : 'IDR'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Select
            value={currency}
            onValueChange={handleCurrencyChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={currencyId}
              aria-invalid={Boolean(currencyError)}
              aria-label="Currency"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <div className="relative">
            <Input
              id={amountId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              disabled={disabled}
              className="pr-16"
              aria-invalid={Boolean(amountError)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {unitLabel}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="amount-conversion-preview">
        {preview}
      </p>
    </div>
  )
}
