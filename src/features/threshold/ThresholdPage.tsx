import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/lib/auth'
import CurrentThresholdCard from './CurrentThresholdCard'
import ThresholdUpdateForm from './ThresholdUpdateForm'
import { useThreshold } from './hooks'

export default function ThresholdPage() {
  const { user } = useAuth()
  const threshold = useThreshold()
  // SoT phase-1.md § Threshold Configuration L78: only Admin can update.
  // SETTINGS section visibility is wider (Admin + Developer per Flag-B), but
  // the update endpoint stays admin-only — DEVELOPER sees the page read-only.
  const canEdit = user?.role === 'ADMIN'

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Threshold"
        italicAccent="Safe routing"
        subtitle={
          canEdit
            ? 'Define the boundary that routes large requests to the Manager Safe.'
            : 'View the active threshold. Updates are restricted to admins.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CurrentThresholdCard data={threshold.data} isLoading={threshold.isLoading} />
        </div>
        <div className="lg:col-span-7">
          {canEdit ? (
            <ThresholdUpdateForm current={threshold.data} />
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
      <p className="font-medium text-foreground">Read-only</p>
      <p className="mt-1">
        Threshold updates are restricted to Admin per SoT § Threshold
        Configuration. Contact an admin if a change is needed.
      </p>
    </div>
  )
}
