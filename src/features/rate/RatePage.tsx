import PageHeader from '@/components/PageHeader'
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

  return (
    <div>
      {/* § 4 P2-1 — empat entri sidebar Settings jadi satu entri "Pengaturan";
          perpindahan antar halaman turun ke tab ini. Gerbang perannya tetap di
          route (`App.tsx`), bukan di tab. */}
      <SettingsTabs />
      <PageHeader
        eyebrow="Pengaturan"
        title="Kurs"
        italicAccent="USD/IDR"
        subtitle={
          canEdit
            ? 'Ubah kurs yang berlaku. Perubahan langsung dipakai oleh setiap mint dan redeem berikutnya.'
            : 'Kurs yang sedang berlaku. Hanya peran Admin yang boleh mengubahnya.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CurrentRateCard data={rate.data} isLoading={rate.isLoading} />
        </div>
        <div className="lg:col-span-7">
          {canEdit ? (
            <RateUpdateForm current={rate.data} />
          ) : (
            <ReadOnlyNotice />
          )}
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
        Peranmu tidak berwenang mengubah kurs. Hubungi Admin kalau kurs memang
        perlu diubah.
      </p>
    </div>
  )
}
