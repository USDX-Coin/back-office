import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Network } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NetworkDistributionProps {
  items: Array<{ network: Network; count: number; share: number }>
}

const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  solana: 'Solana',
  base: 'Base',
}

export default function NetworkDistribution({ items }: NetworkDistributionProps) {
  return (
    <Card className="rounded-md h-full py-0 gap-0 shadow-none dark:border-0">
      <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0 [.border-b]:border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold">Network split</CardTitle>
          <span className="font-mono text-[11.5px] text-muted-foreground">
            by_volume
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No network activity in the last 30 days.
          </p>
        ) : (
          <ul>
            {items.map(({ network, share }, i) => (
              <li
                key={network}
                className={cn(
                  'grid items-center py-2 text-[12px]',
                  i < items.length - 1 && 'border-b border-border'
                )}
                style={{ gridTemplateColumns: '80px 1fr 60px' }}
              >
                <span className="font-medium">{NETWORK_LABEL[network]}</span>
                <span className="mx-3 h-[3px] overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </span>
                <span className="text-right font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  {share.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
