import PageHeader from '@/components/PageHeader'
import SettingsTabs from '@/components/layout/SettingsTabs'
import CurrentThresholdCard from './CurrentThresholdCard'
import ThresholdUpdateForm from './ThresholdUpdateForm'
import { useThreshold } from './hooks'

// Route is gated to ADMIN only via RoleGuard in App.tsx (Linear USDX-53 AC3,
// sot/phase-1.md L516 "Threshold Management — admin only"). Non-ADMIN never
// reaches this component.
export default function ThresholdPage() {
  const threshold = useThreshold()

  return (
    <div>
      <SettingsTabs />
      <PageHeader
        title="Batas Safe Manager"
        subtitle="Batas nominal yang membuat request besar diarahkan ke dompet Safe Manager, bukan dompet Safe Staf."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CurrentThresholdCard data={threshold.data} isLoading={threshold.isLoading} />
        </div>
        <div className="lg:col-span-7">
          <ThresholdUpdateForm current={threshold.data} />
        </div>
      </div>
    </div>
  )
}
