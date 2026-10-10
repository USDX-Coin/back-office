import { useState } from 'react'
import { Button } from '@/components/ui/button'
import SettingsTabs from '@/components/layout/SettingsTabs'
import { useAuth } from '@/lib/auth'
import { canManageRate } from '@/lib/types'
import CurrentRateCard from './CurrentRateCard'
import RateUpdateForm from './RateUpdateForm'
import { useRate } from './hooks'

export default function RatePage() {
  const { user } = useAuth()
  const rate = useRate()
  const canEdit = !!user && canManageRate(user.role)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div>
      {/* § 4 P2-1 — empat entri sidebar Settings jadi satu entri "Pengaturan";
          perpindahan antar halaman turun ke tab ini. Gerbang perannya tetap di
          route (`App.tsx`), bukan di tab. */}
      <SettingsTabs
        subtitle={
          canEdit
            ? 'Ubah kurs yang berlaku. Perubahan langsung dipakai oleh setiap mint dan redeem berikutnya.'
            : 'Kurs yang sedang berlaku. Hanya peran Admin yang boleh mengubahnya.'
        }
      />

      {/* Audit layout Pengaturan (11 Okt 2026): kartu "saat ini" + tombol ubah
          di kanan atas; form ubah di dialog, bukan kartu besar di sampingnya. */}
      <div className="space-y-4">
        <CurrentRateCard
          data={rate.data}
          isLoading={rate.isLoading}
          action={
            canEdit ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                Ubah kurs
              </Button>
            ) : null
          }
        />
        {!canEdit && <ReadOnlyNotice />}
      </div>
      {canEdit && <RateUpdateForm current={rate.data} open={formOpen} onOpenChange={setFormOpen} />}
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
        Peranmu tidak berwenang mengubah kurs. Hubungi Admin kalau kurs memang
        perlu diubah.
      </p>
    </div>
  )
}
