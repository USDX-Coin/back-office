import type { StatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'

// Dot + label pill for a `StatusConfig`. Five feature files carry a private
// `StatusBadge` with this exact markup (transactions, multisig, kyc); new code
// (USDX-631) uses this one instead of adding a sixth copy — folding the
// existing five in is a cleanup ticket, not this one.
export default function StatusPill({
  cfg,
  className,
}: {
  cfg: StatusConfig
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
        cfg.className,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  )
}
