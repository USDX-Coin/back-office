import { Landmark } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import BalanceCards from './BalanceCards'
import { useBniAccounts, useBniBalances } from './hooks'
import StatementPanel from './StatementPanel'

// USDX-631 — "Rekening BNI" (/bni-accounts), every backoffice role
// (sot/bni-integration.md § 16, K5). Read-only: balances and statements LIVE
// from BNIdirect via the backend; nothing is stored, nothing is matched to
// orders. Account labels come from the env list (no bank call) so the page
// still knows its three accounts when the bank is down.

export default function BniAccountsPage() {
  const accounts = useBniAccounts()
  const list = accounts.data ?? []
  const balances = useBniBalances(accounts.isSuccess && list.length > 0)

  return (
    <div>
      <PageHeader
        eyebrow="Treasury"
        title="Rekening BNI"
        italicAccent="saldo & mutasi"
        subtitle="Saldo dan rekening koran LIVE dari BNIdirect untuk tiga rekening MAF. Hanya membaca — tidak ada transfer, tidak disambungkan ke order."
      />

      {accounts.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      ) : accounts.isError ? (
        <div className="rounded-md border border-border bg-card">
          <TableErrorState
            title="Daftar rekening BNI tidak dapat dimuat"
            description="Permintaan ke backend gagal. Periksa koneksi lalu coba lagi."
            onRetry={() => void accounts.refetch()}
          />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-border bg-card" data-testid="bni-unconfigured">
          <TableEmptyState
            mode="no-data"
            icon={<Landmark className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Rekening BNI belum dikonfigurasi"
            description="Backend belum punya satu pun nomor rekening BNI di env (BNI_COLLECTION_ACCOUNT_NO / BNI_TREASURY_*)."
          />
        </div>
      ) : (
        <>
          <BalanceCards
            accounts={list}
            balances={balances.data}
            error={balances.error}
            isPending={balances.isPending}
            isFetching={balances.isFetching}
            onRefetch={() => void balances.refetch()}
          />
          <StatementPanel accounts={list} />
        </>
      )}
    </div>
  )
}
