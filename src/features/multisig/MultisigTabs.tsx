import { SAFE_TX_TABS } from '@/lib/multisig/status'
import type { SafeTxStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMultisigStatusCount } from './hooks'

// Live "(N)" badge for the actionable / in-flight tabs (Pending Sign / Ready to
// Execute / Confirming). One lightweight count query per status (limit=1).
function TabCount({ status }: { status: SafeTxStatus }) {
  const { data } = useMultisigStatusCount(status)
  if (data == null || data === 0) return null
  // Angka sebagai teks "(n)", sama dengan `TabBar` (Transaksi), bukan pil.
  return <span className="ml-1 tabular-nums">({data})</span>
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
      aria-label="Status transaksi Safe"
      className="mb-3 flex flex-wrap items-center gap-1 border-b border-border"
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
              // Satu gaya tab dengan `TabBar` (sapu bersih 11 Okt 2026).
              '-mb-px flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
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
