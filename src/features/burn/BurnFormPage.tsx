import PageHeader from '@/components/PageHeader'
import RateSnapshotCard from '@/components/RateSnapshotCard'
import BurnRequestForm from './BurnRequestForm'
import BurnRequestInfoPanel from './BurnRequestInfoPanel'

export default function BurnFormPage() {
  return (
    <div>
      <PageHeader
        title="Buat redeem OTC"
        subtitle="Ajukan redeem OTC setelah nasabah menyetor USDX ke dompet Safe. Permintaannya masuk antrean tanda tangan dan muncul di halaman OTC."
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
