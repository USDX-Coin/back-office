import { Link } from 'react-router'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Network, ReportRow } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { getOtcStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'

interface RecentActivityListProps {
  items: ReportRow[]
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

export default function RecentActivityList({ items }: RecentActivityListProps) {
  return (
    <Card className="rounded-md py-0 gap-0 shadow-none dark:border-0 overflow-hidden">
      <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold">
            Recent activity
          </CardTitle>
          <Link
            to="/report"
            className="font-mono text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            View report →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border">
                <Th>Customer</Th>
                <Th>Direction</Th>
                <Th>Amount</Th>
                <Th>Network</Th>
                <Th>Status</Th>
                <Th className="text-right">When</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const statusCfg = getOtcStatusConfig(item.status)
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md border border-border bg-muted text-[9.5px] font-medium">
                          {getInitials(item.customerName)}
                        </span>
                        <span className="font-medium">{item.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11.5px]',
                          item.kind === 'mint'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                      >
                        {item.kind === 'mint' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {item.kind === 'mint' ? 'Mint' : 'Redeem'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {item.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            NETWORK_DOT[item.network]
                          )}
                        />
                        {NETWORK_LABEL[item.network]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                          statusCfg.className
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            statusCfg.dotClass
                          )}
                        />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-4 py-2 text-left font-mono text-[11px] font-medium text-muted-foreground/80',
        className
      )}
    >
      {children}
    </th>
  )
}
