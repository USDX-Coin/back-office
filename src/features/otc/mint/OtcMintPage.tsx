import OtcMintForm from './OtcMintForm'
import OtcMintInfoPanel from './OtcMintInfoPanel'
import RecentRequestsList from './RecentRequestsList'
import { useRecentMints } from './hooks'

export default function OtcMintPage() {
  const recent = useRecentMints()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-on-surface">OTC Minting</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Issue new USDX to a customer's destination wallet. Settlement is
          asynchronous; pending requests appear on the right.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <OtcMintForm />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <OtcMintInfoPanel />
          <RecentRequestsList
            items={recent.data?.data ?? []}
            isLoading={recent.isLoading}
          />
        </div>
      </div>
    </div>
  )
}
