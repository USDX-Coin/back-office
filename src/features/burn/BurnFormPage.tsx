import PageHeader from '@/components/PageHeader'
import RateSnapshotCard from '@/components/RateSnapshotCard'
import BurnRequestForm from './BurnRequestForm'
import BurnRequestInfoPanel from './BurnRequestInfoPanel'

export default function BurnFormPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Burn"
        italicAccent="redeem USDX"
        subtitle="Submit an OTC burn after the user has deposited USDX to the Safe wallet. The request enters the approval lifecycle and appears on the Burn list."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <BurnRequestForm />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <RateSnapshotCard />
          <BurnRequestInfoPanel />
        </div>
      </div>
    </div>
  )
}
