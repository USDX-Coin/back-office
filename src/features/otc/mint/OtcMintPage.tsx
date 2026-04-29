import PageHeader from '@/components/PageHeader'
import OtcMintForm from './OtcMintForm'
import OtcMintInfoPanel from './OtcMintInfoPanel'
import RecentRequestsList from './RecentRequestsList'
import { useRecentMints } from './hooks'

export default function OtcMintPage() {
  const recent = useRecentMints()

  return (
    <div>
      <PageHeader title="Mint" />

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
