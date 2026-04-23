import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

export default function RecentRedemptionsTable({ items, isLoading }: RecentRedemptionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={3} className="text-sm">
          Recent redemptions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No redemptions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Transaction ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 5).map((item) => {
                const cfg = getOtcStatusConfig(item.status)
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => copyHash(item.txHash)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-primary"
                        title={item.txHash}
                        aria-label={`Copy ${item.txHash}`}
                      >
                        {shortHash(item.txHash)}
                        <Copy className="h-3 w-3 opacity-40" />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.amount.toLocaleString()} USDX
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            'inline-flex h-1.5 w-1.5 rounded-full',
                            NETWORK_DOT[item.network] ?? 'bg-slate-400'
                          )}
                        />
                        {item.network.charAt(0).toUpperCase() + item.network.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
