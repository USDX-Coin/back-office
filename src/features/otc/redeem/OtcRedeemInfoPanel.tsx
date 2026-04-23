import { Droplets } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AVAILABLE_BALANCE = 5_000_000
const TREASURY_HEALTH_PCT = 82

export default function OtcRedeemInfoPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Droplets className="h-4 w-4 text-primary" />
            Treasury liquidity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              {AVAILABLE_BALANCE.toLocaleString()} <span className="text-base font-medium text-muted-foreground">USDX</span>
            </p>
            <p className="text-xs text-muted-foreground">Available for redemption</p>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${TREASURY_HEALTH_PCT}%` }}
                aria-label={`${TREASURY_HEALTH_PCT}% treasury health`}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Treasury health: {TREASURY_HEALTH_PCT}%
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Operations guide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Daily redemption cap 5,000,000 USDX. For amounts exceeding this threshold,
            contact compliance to schedule an OTC batch.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Redeem fee</p>
            <p className="mt-1 text-lg font-semibold">0.15%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Slippage</p>
            <p className="mt-1 text-lg font-semibold">&lt;0.01%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { AVAILABLE_BALANCE }
