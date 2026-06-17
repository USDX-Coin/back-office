import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  // USDX-207: rate is directional. Mint (beli) previews with effectiveBuyRate,
  // burn (jual) with effectiveSellRate. Default 'buy'.
  direction?: 'buy' | 'sell'
}

const CURRENCIES: { value: AmountCurrency; hint: string }[] = [
  { value: 'USD', hint: 'USDX 1:1' },
  { value: 'IDR', hint: 'auto-convert' },
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
  direction = 'buy',
}: AmountWithCurrencyInputProps) {
  const { data: rate, isError: rateError, isLoading: rateLoading } = useRate()

  const amountNum = Number(amount.trim())
  const effectiveRate = rate
    ? direction === 'sell'
      ? rate.effectiveSellRate
      : rate.effectiveBuyRate
    : undefined
  const rateNum = effectiveRate ? Number(effectiveRate) : Number.NaN
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

  return (
    <div className={cn('space-y-2', className)}>
      {/* USDX-27 polish: rendered as a SINGLE bordered field — the amount
          input takes the wide left side, the currency dropdown is a compact
          segment on the right. The inner controls drop their own borders/rings
          so it reads as one input with a code segment, not two fields jammed
          together. */}
      <div
        className={cn(
          'flex h-9 items-stretch rounded-md border border-input bg-secondary text-sm ring-offset-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Input
          id={amountId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-invalid={Boolean(amountError)}
        />
        <span aria-hidden="true" className="my-1.5 w-px bg-border/70" />
        <Select
          value={currency}
          onValueChange={handleCurrencyChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={currencyId}
            aria-invalid={Boolean(currencyError)}
            aria-label="Currency"
            className="h-full w-auto shrink-0 gap-1.5 rounded-none border-0 bg-transparent px-3 font-mono text-sm shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0"
          >
            <span>{currency}</span>
          </SelectTrigger>
          <SelectContent align="end">
            {CURRENCIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <span className="font-mono">{c.value}</span>
                <span className="ml-2 text-muted-foreground">({c.hint})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="amount-conversion-preview">
        {preview}
      </p>
    </div>
  )
}
