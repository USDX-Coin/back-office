import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div>
      <SettingsTabs />
      <PageHeader
        title="Biaya"
        subtitle={
          canEdit
            ? 'Atur biaya mint dan biaya acuan payment gateway. Perubahan berlaku untuk setiap order berikutnya.'
            : 'Biaya yang sedang berlaku. Hanya peran Admin yang boleh mengubahnya.'
        }
      />

      {/* Audit layout Pengaturan (11 Okt 2026): kartu "saat ini" + tombol ubah
          di kanan atas; form ubah di dialog, bukan kartu besar di sampingnya. */}
      <div className="max-w-3xl space-y-4">
        <CurrentFeeConfigCard
          data={fee.data}
          isLoading={fee.isLoading}
          action={
            canEdit ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                Ubah biaya
              </Button>
            ) : null
          }
        />
        {!canEdit && <ReadOnlyNotice />}
      </div>
      {canEdit && <FeeConfigUpdateForm current={fee.data} open={formOpen} onOpenChange={setFormOpen} />}
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
