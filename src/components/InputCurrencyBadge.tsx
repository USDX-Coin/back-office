import type { AmountCurrency } from '@/lib/types'

// USDX-35 AC6: marks which currency the operator originally typed in the
// mint/burn form. Sits next to the matching line in the Amount column so
// reviewers can tell USD-originated rows from IDR-originated ones at a glance.

export default function InputCurrencyBadge({ currency }: { currency: AmountCurrency }) {
  return (
    <span
      data-testid="input-currency-badge"
      data-currency={currency}
      aria-label={`Operator entered amount in ${currency}`}
      className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.04em] text-muted-foreground"
    >
      {currency}
    </span>
  )
}
