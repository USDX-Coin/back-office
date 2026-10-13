import { useState } from 'react'
import { Button } from '@/components/ui/button'
import SettingsTabs from '@/components/layout/SettingsTabs'
import CurrentThresholdCard from './CurrentThresholdCard'
import ThresholdUpdateForm from './ThresholdUpdateForm'
import { useThreshold } from './hooks'

// Route is gated to ADMIN only via RoleGuard in App.tsx (Linear USDX-53 AC3,
// sot/phase-1.md L516 "Threshold Management — admin only"). Non-ADMIN never
// reaches this component.
export default function ThresholdPage() {
  const threshold = useThreshold()
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div>
      <SettingsTabs
        subtitle="Permintaan OTC dengan nominal sebesar ini atau lebih ditandatangani lewat dompet Safe Manager, bukan Safe Staf."
      />

      {/* Audit layout Pengaturan (11 Okt 2026): kartu "saat ini" + tombol ubah
          di kanan atas; form ubah di dialog, bukan kartu besar di sampingnya. */}
      <div>
        <CurrentThresholdCard
          data={threshold.data}
          isLoading={threshold.isLoading}
          action={
            <Button type="button" onClick={() => setFormOpen(true)}>
              Ubah batas
            </Button>
          }
        />
      </div>
      <ThresholdUpdateForm current={threshold.data} open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
