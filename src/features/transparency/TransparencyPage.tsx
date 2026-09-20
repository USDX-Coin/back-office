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
        eyebrow="Keuangan"
        title="Cadangan & Atestasi"
        italicAccent="buku besar"
        subtitle={
          canWrite
            ? 'Setiap entri yang dicatat di sini langsung mengubah angka cadangan yang tayang di usdx.co.id. Buku besarnya hanya bisa ditambah — koreksi dilakukan dengan mencatat entri baru, tidak pernah dengan menyunting atau menghapus.'
            : 'Buku besar cadangan dan laporan atestasi di balik angka publik di usdx.co.id. Mencatat entri hanya untuk peran Admin.'
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
      <p className="font-medium text-foreground">Hanya bisa dilihat</p>
      <p className="mt-1">
        Peran akun ini tidak bisa mencatat entri cadangan atau mengelola laporan
        atestasi. Hubungi Admin kalau ada yang perlu diubah.
      </p>
    </div>
  )
}
