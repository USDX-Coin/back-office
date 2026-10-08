import { Landmark } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import BalanceCards from './BalanceCards'
import { useBniAccounts, useBniBalances } from './hooks'
import StatementPanel from './StatementPanel'

// USDX-631 / USDX-692 — "Rekening BNI" (/bni-accounts), every backoffice role
// (sot/bni-integration.md § 16, K5). Read-only: balances LIVE from BNIdirect
// via the backend; statements from the USDX copy bni-service records every 10
// minutes (D24, § 16.8 — the bank only serves the running day). Nothing is
// matched to orders. Account labels come from the env list (no bank call) so the page
// still knows its three accounts when the bank is down.

export default function BniAccountsPage() {
  const accounts = useBniAccounts()
  const list = accounts.data ?? []
  const balances = useBniBalances(accounts.isSuccess && list.length > 0)

  return (
    <div>
      <PageHeader
        title="Rekening BNI"
        subtitle="Saldo langsung dari BNI, dan mutasi yang direkam USDX tiap 10 menit, untuk tiga rekening perusahaan. Halaman ini hanya membaca — tidak ada transfer."
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
            // P1-5 — dulu kalimat ini mencetak NAMA VARIABEL ENVIRONMENT
            // (`BNI_COLLECTION_ACCOUNT_NO / BNI_TREASURY_*`) ke layar operator.
            // Operator tidak punya akses ke env dan tidak bisa berbuat apa pun
            // dengan nama itu; yang ia butuhkan adalah tahu harus menghubungi
            // siapa. Nama variabelnya tetap hidup di catatan tim teknis.
            description="Belum ada satu pun nomor rekening BNI yang terpasang di sistem. Hubungi tim teknis untuk memasangnya."
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
