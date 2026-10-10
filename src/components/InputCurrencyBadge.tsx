import type { AmountCurrency } from '@/lib/types'

// USDX-35 AC6: marks which currency the operator originally typed in the
// mint/burn form. Sits next to the matching line in the Amount column so
// reviewers can tell USD-originated rows from IDR-originated ones at a glance.

export default function InputCurrencyBadge({ currency }: { currency: AmountCurrency }) {
  return (
    <span
      data-testid="input-currency-badge"
      data-currency={currency}
      aria-label={`Nominal diinput operator dalam ${currency}`}
      className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-label uppercase leading-none text-muted-foreground"
    >
      {currency}
    </span>
  )
}
