import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Network, OtcRedeemTransaction } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusPill } from '@/components/StatusPill'

interface RecentRedemptionsTableProps {
  items: OtcRedeemTransaction[]
  isLoading: boolean
}

const NETWORK_DOT: Record<Network, string> = {
  ethereum: 'bg-[#627EEA]',
  polygon: 'bg-[#8247E5]',
  arbitrum: 'bg-[#28A0F0]',
  solana: 'bg-[#9945FF]',
  base: 'bg-[#0052FF]',
}

const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  solana: 'Solana',
  base: 'Base',
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
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle
          role="heading"
          aria-level={3}
          className="text-[13px] font-semibold"
        >
          Recent redemptions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No redemptions yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  Tx
                </TableHead>
                <TableHead className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  Amount
                </TableHead>
                <TableHead className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  Network
                </TableHead>
                <TableHead className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  When
                </TableHead>
                <TableHead className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 5).map((item) => {
                return (
                  <TableRow
                    key={item.id}
                    className="border-border last:border-0 hover:bg-muted/40"
                  >
                    <TableCell className="px-4 py-2.5 text-[12.5px]">
                      <button
                        type="button"
                        onClick={() => copyHash(item.txHash)}
                        className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground hover:text-primary"
                        title={item.txHash}
                        aria-label={`Copy ${item.txHash}`}
                      >
                        {shortHash(item.txHash)}
                        <Copy className="h-3 w-3 opacity-40" />
                      </button>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-mono font-medium tabular-nums">
                      {item.amount.toLocaleString()}{' '}
                      <span className="text-muted-foreground">USDX</span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            NETWORK_DOT[item.network]
                          )}
                        />
                        {NETWORK_LABEL[item.network]}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-mono text-[11.5px] text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <StatusPill status={item.status} appearance="soft" />
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
