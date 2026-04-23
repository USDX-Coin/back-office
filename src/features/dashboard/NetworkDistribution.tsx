import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Network } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NetworkDistributionProps {
  items: Array<{ network: Network; count: number; share: number }>
}

const NETWORK_COLOR: Record<Network, string> = {
  ethereum: 'bg-slate-400',
  polygon: 'bg-purple-500',
  arbitrum: 'bg-blue-500',
  solana: 'bg-emerald-500',
  base: 'bg-blue-400',
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Network Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No network activity in the last 30 days.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map(({ network, count, share }) => (
              <li key={network}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn('inline-block h-2 w-2 rounded-full', NETWORK_COLOR[network])} />
                    {NETWORK_LABEL[network]}
                  </span>
                  <span className="font-medium">
                    {count} · {share.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full', NETWORK_COLOR[network])}
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
