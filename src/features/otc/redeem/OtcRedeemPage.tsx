import OtcRedeemForm from './OtcRedeemForm'
import OtcRedeemInfoPanel from './OtcRedeemInfoPanel'
import RecentRedemptionsTable from './RecentRedemptionsTable'
import { useRecentRedeems } from './hooks'

export default function OtcRedeemPage() {
  const recent = useRecentRedeems()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-on-surface">OTC Redemption</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Burn USDX in exchange for treasury funds. Settlement is asynchronous;
          recent redemptions appear below.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <OtcRedeemForm />
        </div>
        <div className="lg:col-span-5">
          <OtcRedeemInfoPanel />
        </div>
      </div>

      <RecentRedemptionsTable
        items={recent.data?.data ?? []}
        isLoading={recent.isLoading}
      />
    </div>
  )
}
