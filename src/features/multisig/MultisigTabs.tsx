import { SAFE_TX_TABS } from '@/lib/multisig/status'
import type { SafeTxStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMultisigStatusCount } from './hooks'

// Live "(N)" badge for the actionable / in-flight tabs (Pending Sign / Ready to
// Execute / Confirming). One lightweight count query per status (limit=1).
function TabCount({ status }: { status: SafeTxStatus }) {
  const { data } = useMultisigStatusCount(status)
  if (data == null || data === 0) return null
  return (
    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-primary">
      {data}
    </span>
  )
}

export default function MultisigTabs({
  active,
  onChange,
}: {
  active: SafeTxStatus | ''
  onChange: (next: SafeTxStatus | '') => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Safe transaction status"
      className="mb-3 flex flex-wrap items-center gap-1 border-b border-outline-variant/15"
    >
      {SAFE_TX_TABS.map((tab) => {
        const isActive = active === tab.value
        return (
          <button
            key={tab.value || 'all'}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative -mb-px flex items-center px-3 py-2 text-[12.5px] font-medium transition-colors',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.showCount && tab.value ? <TabCount status={tab.value} /> : null}
          </button>
        )
      })}
    </div>
  )
}
