import OtcRedeemForm from './OtcRedeemForm'
import OtcRedeemInfoPanel from './OtcRedeemInfoPanel'
import RecentRedemptionsTable from './RecentRedemptionsTable'
import { useRecentRedeems } from './hooks'

export default function OtcRedeemPage() {
  const recent = useRecentRedeems()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OTC Redemption</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
