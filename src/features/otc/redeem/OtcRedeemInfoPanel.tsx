import { ShieldCheck, Droplets } from 'lucide-react'

const AVAILABLE_BALANCE = 5_000_000

export default function OtcRedeemInfoPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-lowest p-5 shadow-ambient-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Droplets className="h-4 w-4" />
          Treasury Liquidity
        </div>
        <p className="mt-2 font-display text-2xl font-bold text-on-surface">
          {AVAILABLE_BALANCE.toLocaleString()} USDX
        </p>
        <p className="text-xs text-on-surface-variant">Available for redemption</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
          <div className="h-full w-[82%] bg-blue-pulse" aria-label="82% treasury health" />
        </div>
        <p className="mt-1.5 text-xs text-on-surface-variant">Treasury health: 82%</p>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-blue-pulse p-6 text-on-primary shadow-md">
        <ShieldCheck className="absolute right-4 top-4 h-5 w-5 opacity-30" />
        <p className="text-xs font-medium uppercase tracking-wider opacity-70">Operations Guide</p>
        <p className="mt-1 font-display text-lg font-semibold">Institutional Redemption</p>
        <p className="mt-2 text-sm opacity-80">
          Daily redemption cap 5,000,000 USDX. For amounts exceeding this
          threshold, contact compliance to schedule an OTC batch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ambient-sm">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant">Redeem Fee</p>
          <p className="mt-1 font-display text-lg font-semibold text-on-surface">0.15%</p>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ambient-sm">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant">Slippage</p>
          <p className="mt-1 font-display text-lg font-semibold text-on-surface">&lt;0.01%</p>
        </div>
      </div>
    </div>
  )
}

export { AVAILABLE_BALANCE }
