import PageHeader from '@/components/PageHeader'
import RateSnapshotCard from '@/components/RateSnapshotCard'
import BurnRequestForm from './BurnRequestForm'
import BurnRequestInfoPanel from './BurnRequestInfoPanel'

export default function BurnFormPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Meja OTC"
        title="Burn OTC baru"
        italicAccent="tarik USDX"
        subtitle="Ajukan burn OTC setelah nasabah menyetor USDX ke dompet Safe. Request masuk ke alur persetujuan dan muncul di daftar Burn OTC."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <BurnRequestForm />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <RateSnapshotCard direction="sell" />
          <BurnRequestInfoPanel />
        </div>
      </div>
    </div>
  )
}
