import PageHeader from '@/components/PageHeader'
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
      <PageHeader
        eyebrow="Settings"
        title="Fee"
        italicAccent="mint & payment"
        subtitle={
          canEdit
            ? 'Set the mint fee and payment-gateway reference fees. Changes apply to every subsequent order.'
            : 'View the active fee config. Updates are restricted to the admin role.'
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
      <p className="font-medium text-foreground">Read-only</p>
      <p className="mt-1">
        Your role does not have permission to update the fee config. Contact an
        admin if a change is needed.
      </p>
    </div>
  )
}
