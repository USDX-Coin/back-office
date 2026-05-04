import PageHeader from '@/components/PageHeader'
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
      <PageHeader
        eyebrow="Configuration"
        title="Rate"
        italicAccent="USD/IDR"
        subtitle={
          canEdit
            ? 'Update the active rate. Changes apply immediately to every subsequent mint and redeem.'
            : 'View the active rate. Updates are restricted to admin and manager roles.'
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
      <p className="font-medium text-foreground">Read-only</p>
      <p className="mt-1">
        Your role does not have permission to update the rate. Contact an admin
        or manager if a change is needed.
      </p>
    </div>
  )
}
