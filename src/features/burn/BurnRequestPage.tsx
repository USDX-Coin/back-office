import PageHeader from '@/components/PageHeader'
import BurnRequestForm from './BurnRequestForm'
import BurnRequestInfoPanel from './BurnRequestInfoPanel'

export default function BurnRequestPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Burn"
        italicAccent="redeem USDX"
        subtitle="Submit an OTC burn after the user has deposited USDX to the Safe wallet. The request enters the approval lifecycle and appears on Requests."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <BurnRequestForm />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <BurnRequestInfoPanel />
        </div>
      </div>
    </div>
  )
}
