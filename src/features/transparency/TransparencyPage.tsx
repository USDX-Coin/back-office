import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/lib/auth'
import { canManageTransparency } from '@/lib/types'
import ReserveBalanceCard from './ReserveBalanceCard'
import LedgerEntryForm from './LedgerEntryForm'
import LedgerHistoryTable from './LedgerHistoryTable'
import AttestationSection from './AttestationSection'
import { useReserveLedger } from './hooks'

/**
 * `/transparency` — the append-only reserve ledger behind the public figures on
 * usdx.co.id, plus the monthly attestation reports.
 *
 * There is no draft state and no publish button: an entry is public the moment
 * it is recorded, which is why the form routes through a confirmation dialog
 * rather than submitting directly. Route access (ADMIN + DEVELOPER) is enforced
 * by `RoleGuard` in App.tsx; recording and attestation writes are ADMIN-only and
 * the backend enforces that again.
 */
export default function TransparencyPage() {
  const { user } = useAuth()
  const canWrite = !!user && canManageTransparency(user.role)
  const [page, setPage] = useState(1)
  const ledger = useReserveLedger(page)

  return (
    <div>
      <PageHeader
        eyebrow="Transparency"
        title="Reserve"
        italicAccent="ledger"
        subtitle={
          canWrite
            ? 'Every entry recorded here changes the reserve figure published on usdx.co.id immediately. The ledger is append-only — corrections are made by recording a new entry, never by editing or deleting one.'
            : 'View the reserve ledger and attestation reports behind the public figures on usdx.co.id. Recording entries is restricted to the admin role.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {/* Straight from `data.balance` — never summed from the table below. */}
          <ReserveBalanceCard
            balance={ledger.data?.balance}
            isLoading={ledger.isLoading}
          />
        </div>
        <div className="lg:col-span-7">
          {canWrite ? (
            <LedgerEntryForm balance={ledger.data?.balance} />
          ) : (
            <ReadOnlyNotice />
          )}
        </div>
      </div>

      <div className="mt-6">
        <LedgerHistoryTable
          data={ledger.data}
          isLoading={ledger.isLoading}
          isError={ledger.isError}
          onRetry={() => ledger.refetch()}
          page={page}
          onPageChange={setPage}
        />
      </div>

      <div className="mt-6">
        <AttestationSection canManage={canWrite} />
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
        Your role does not have permission to record reserve entries or manage
        attestation reports. Contact an admin if a change is needed.
      </p>
    </div>
  )
}
