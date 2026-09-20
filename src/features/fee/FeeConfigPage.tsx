import PageHeader from '@/components/PageHeader'
import SettingsTabs from '@/components/layout/SettingsTabs'
import { useAuth } from '@/lib/auth'
import { canManageFeeConfig } from '@/lib/types'
import CurrentFeeConfigCard from './CurrentFeeConfigCard'
import FeeConfigUpdateForm from './FeeConfigUpdateForm'
import { useFeeConfig } from './hooks'

// USDX-207 + sot/api/fee.yaml: read is open to every backoffice role; update is
// admin-only (POST 403). Non-admin sees the current config + a read-only notice
// instead of the form (mirrors the Rate page).
export default function FeeConfigPage() {
  const { user } = useAuth()
  const fee = useFeeConfig()
  const canEdit = !!user && canManageFeeConfig(user.role)

  return (
    <div>
      <SettingsTabs />
      <PageHeader
        eyebrow="Pengaturan"
        title="Biaya"
        italicAccent="mint & pembayaran"
        subtitle={
          canEdit
            ? 'Atur biaya mint dan biaya acuan payment gateway. Perubahan berlaku untuk setiap order berikutnya.'
            : 'Biaya yang sedang berlaku. Hanya peran Admin yang boleh mengubahnya.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CurrentFeeConfigCard data={fee.data} isLoading={fee.isLoading} />
        </div>
        <div className="lg:col-span-7">
          {canEdit ? <FeeConfigUpdateForm current={fee.data} /> : <ReadOnlyNotice />}
        </div>
      </div>
    </div>
  )
}

function ReadOnlyNotice() {
  return (
    <div
      role="note"
      className="rounded-md border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground"
    >
      <p className="font-medium text-foreground">Hanya bisa melihat</p>
      <p className="mt-1">
        Peranmu tidak berwenang mengubah biaya. Hubungi Admin kalau biaya memang
        perlu diubah.
      </p>
    </div>
  )
}
