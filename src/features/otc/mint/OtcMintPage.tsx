import PageHeader from '@/components/PageHeader'
import OtcMintForm from './OtcMintForm'
import OtcMintInfoPanel from './OtcMintInfoPanel'
import RecentRequestsList from './RecentRequestsList'
import { useRecentMints } from './hooks'

export default function OtcMintPage() {
  const recent = useRecentMints()

  return (
    <div>
      <PageHeader
        eyebrow="OTC Desk"
        title="Mint"
        italicAccent="issue USDX"
        subtitle="Single-shot mint to a customer's destination wallet. Settlement is asynchronous — pending requests appear on the right."
      />

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
