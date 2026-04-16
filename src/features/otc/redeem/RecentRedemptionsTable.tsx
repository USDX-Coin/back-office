import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import type { OtcRedeemTransaction } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { getOtcStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'

interface RecentRedemptionsTableProps {
  items: OtcRedeemTransaction[]
  isLoading: boolean
}

const NETWORK_DOT: Record<string, string> = {
  ethereum: 'bg-slate-400',
  polygon: 'bg-purple-500',
  arbitrum: 'bg-blue-500',
  solana: 'bg-emerald-500',
  base: 'bg-blue-400',
}

function shortHash(hash: string): string {
  if (hash.length < 14) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

async function copyHash(hash: string) {
  try {
    await navigator.clipboard.writeText(hash)
    toast.success('Transaction ID copied')
  } catch {
    toast.error('Copy failed')
  }
}

export default function RecentRedemptionsTable({
  items,
  isLoading,
}: RecentRedemptionsTableProps) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 shadow-ambient-sm">
      <h3 role="heading" aria-level={3} className="mb-3 text-sm font-medium text-on-surface">
        Recent Redemptions
      </h3>
      {isLoading && items.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">No redemptions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="pb-2 pr-4 text-left font-medium">Transaction ID</th>
                <th className="pb-2 pr-4 text-left font-medium">Amount</th>
                <th className="pb-2 pr-4 text-left font-medium">Network</th>
                <th className="pb-2 pr-4 text-left font-medium">When</th>
                <th className="pb-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 5).map((item) => {
                const cfg = getOtcStatusConfig(item.status)
                return (
                  <tr
                    key={item.id}
                    className="text-sm transition-colors hover:bg-surface-container-highest/60"
                  >
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        onClick={() => copyHash(item.txHash)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-on-surface hover:text-primary"
                        title={item.txHash}
                        aria-label={`Copy ${item.txHash}`}
                      >
                        {shortHash(item.txHash)}
                        <Copy className="h-3 w-3 opacity-40" />
                      </button>
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-on-surface">
                      {item.amount.toLocaleString()} USDX
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span
                          className={cn(
                            'inline-flex h-1.5 w-1.5 rounded-full',
                            NETWORK_DOT[item.network] ?? 'bg-slate-400'
                          )}
                        />
                        {item.network.charAt(0).toUpperCase() + item.network.slice(1)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-on-surface-variant">
                      {formatRelativeTime(item.createdAt)}
                    </td>
                    <td className="py-2.5">
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.label}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
