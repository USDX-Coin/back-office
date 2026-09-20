// USDX-16 — renders the SoT /api/v1/dashboard/stats payload.
// All quantity values arrive from the API as decimal strings (USDX has 6
// on-chain decimals; the API returns the human-readable form). This view
// formats them as USDX with grouping but never coerces to Number, so we
// don't lose precision on > 2^53 values.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDecimalId, formatIdrRate } from '@/lib/format'
import { getRequestStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'

// P1-5 — label diambil dari peta `Record<Enum, StatusConfig>` yang sudah jadi
// sumber tunggal (`src/lib/status.ts`), bukan dari salinan kedua yang bisa
// menyimpang diam-diam dari layar lain.
const REQUEST_STATUS_LABELS: Record<keyof DashboardStats['requestsByStatus'], string> = {
  PENDING_APPROVAL: getRequestStatusConfig('PENDING_APPROVAL').label,
  APPROVED: getRequestStatusConfig('APPROVED').label,
  EXECUTED: getRequestStatusConfig('EXECUTED').label,
  REJECTED: getRequestStatusConfig('REJECTED').label,
}

const REQUEST_STATUS_DOT: Record<keyof DashboardStats['requestsByStatus'], string> = {
  PENDING_APPROVAL: 'bg-warning',
  APPROVED: 'bg-primary',
  EXECUTED: 'bg-success',
  REJECTED: 'bg-destructive',
}

interface StatCardProps {
  label: string
  value: string
  unit?: string
  description?: string
  loading?: boolean
  testId?: string
}

function StatCard({ label, value, unit, description, loading, testId }: StatCardProps) {
  return (
    <Card
      className="rounded-md py-0 gap-0 shadow-none dark:border-0"
      data-testid={testId}
    >
      <CardContent className="px-4 py-3.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-6 w-24" />
        ) : (
          <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
            {unit && (
              <span className="ml-1 text-[11.5px] font-mono font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </p>
        )}
        {description && (
          <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface Phase1StatsProps {
  data?: DashboardStats
  isLoading: boolean
}

export default function Phase1Stats({ data, isLoading }: Phase1StatsProps) {
  // P0-5 — kartu "Pending requests" DIHAPUS dari sini. Ia menaut ke
  // `/requests?status=PENDING_APPROVAL`, rute yang tidak pernah didaftarkan di
  // `App.tsx`: kena wildcard → `Navigate to="/login"` → `PublicRoute` melihat
  // sesi masih hidup → dilempar balik ke `/dashboard`. Kartu itu memantul diam-
  // diam ke halaman yang sama selama berbulan-bulan, dan tesnya hijau karena
  // hanya memeriksa atribut `href`.
  //
  // Angkanya TIDAK hilang: `QueueBoard` di atas menampilkannya sebagai dua
  // kartu terpisah (Mint OTC + Burn OTC) yang menaut ke `/mint?status=…` dan
  // `/burn?status=…` — dua rute yang benar-benar ada, dan masing-masing
  // mendarat di daftar yang tepat. Subtitle halaman masih menyebut totalnya.
  return (
    <section data-testid="dashboard-phase1-stats" aria-label="Statistik jaringan USDX">
      <div className={cn('mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3')}>
        <StatCard
          label="Pasokan beredar"
          value={data ? formatDecimalId(data.totalSupply) : '—'}
          unit="USDX"
          description="Jumlah token di blockchain"
          loading={isLoading}
          testId="stat-total-supply"
        />
        <StatCard
          label="Total pernah dicetak"
          value={data ? formatDecimalId(data.totalMinted) : '—'}
          unit="USDX"
          description="Sejak awal"
          loading={isLoading}
          testId="stat-total-minted"
        />
        <StatCard
          label="Total pernah dibakar"
          value={data ? formatDecimalId(data.totalBurned) : '—'}
          unit="USDX"
          description="Sejak awal"
          loading={isLoading}
          testId="stat-total-burned"
        />
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-requests-by-status"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Request OTC per status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ul className="space-y-2.5">
                {(
                  Object.entries(data.requestsByStatus) as Array<[
                    keyof DashboardStats['requestsByStatus'],
                    number,
                  ]>
                ).map(([key, count]) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 text-[12.5px]"
                    data-testid={`requests-status-${key}`}
                  >
                    <span
                      className={cn('h-1.5 w-1.5 rounded-full', REQUEST_STATUS_DOT[key])}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-foreground/90">
                      {REQUEST_STATUS_LABELS[key]}
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {count.toLocaleString('id-ID')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-safe-balances"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Saldo dompet Safe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div data-testid="safe-balance-staff">
                  <p className="text-[11px] text-muted-foreground">Dompet Staf</p>
                  <p className="mt-1 font-mono text-[14px] font-semibold tabular-nums">
                    {formatDecimalId(data.safeBalances.staff)}
                    <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
                      USDX
                    </span>
                  </p>
                </div>
                <div data-testid="safe-balance-manager">
                  <p className="text-[11px] text-muted-foreground">Dompet Manager</p>
                  <p className="mt-1 font-mono text-[14px] font-semibold tabular-nums">
                    {formatDecimalId(data.safeBalances.manager)}
                    <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
                      USDX
                    </span>
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-current-rate"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Kurs berlaku
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading || !data ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <p className="font-mono text-[22px] font-semibold tabular-nums">
                  {formatIdrRate(data.currentRate)}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  per 1 USDX (USD/IDR)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
