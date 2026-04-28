import { Droplets } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AVAILABLE_BALANCE = 5_000_000
const TREASURY_HEALTH_PCT = 82

export default function OtcRedeemInfoPanel() {
  return (
    <div className="space-y-4">
      <Card className="rounded-md shadow-none dark:border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
            <Droplets className="h-3.5 w-3.5 text-primary" />
            Treasury liquidity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[22px] font-semibold tracking-tight tabular-nums">
              {AVAILABLE_BALANCE.toLocaleString()}{' '}
              <span className="text-[13px] font-medium text-muted-foreground">
                USDX
              </span>
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              Available for redemption
            </p>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${TREASURY_HEALTH_PCT}%` }}
                aria-label={`${TREASURY_HEALTH_PCT}% treasury health`}
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              Treasury health: {TREASURY_HEALTH_PCT}%
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none dark:border-0">
        <CardHeader>
          <CardTitle className="text-[13px] font-semibold">
            Operations guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[12.5px] text-muted-foreground">
            Daily redemption cap 5,000,000 USDX. For amounts exceeding this
            threshold, contact compliance to schedule an OTC batch.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-md py-0 gap-0 shadow-none dark:border-0">
          <CardContent className="px-4 py-3.5">
            <p className="text-[11px] text-muted-foreground">Redeem fee</p>
            <p className="mt-2 text-[18px] font-semibold tabular-nums">0.15%</p>
          </CardContent>
        </Card>
        <Card className="rounded-md py-0 gap-0 shadow-none dark:border-0">
          <CardContent className="px-4 py-3.5">
            <p className="text-[11px] text-muted-foreground">Slippage</p>
            <p className="mt-2 text-[18px] font-semibold tabular-nums">
              &lt;0.01%
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { AVAILABLE_BALANCE }
