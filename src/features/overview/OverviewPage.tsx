import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { canAccessRequestList, canManageSettings, useAuth } from '@/lib/auth'
import { formatBankAmount, formatDecimalId, formatIdrRate, formatDateTime } from '@/lib/format'
import { getRequestStatusConfig } from '@/lib/status'
import { formatAmountDecimal } from '@/lib/transparency'
import type { BniAccount, BniBalances, DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { useBniAccounts, useBniBalances } from '@/features/bni-accounts/hooks'
import { resolveBalanceCardStates } from '@/features/bni-accounts/balanceCardState'
import { useReserveLedger } from '@/features/transparency/hooks'
import { useDashboardStats } from './hooks'

/**
 * Ringkasan — halaman pertama setelah masuk (keputusan PM 10 Okt 2026).
 *
 * HANYA data yang sudah disajikan backend dev; tidak ada angka karangan:
 *   - `GET /api/v1/queue-counts`        → yang perlu tindakan (tautan ke tab
 *                                          "Perlu tindakan" di Transaksi)
 *   - `GET /api/v1/dashboard/stats`     → pasokan on-chain, saldo Safe, kurs,
 *                                          dan angka OTC (diberi label khusus OTC)
 *   - `GET /api/v1/bni-accounts/balances` → TIDAK ditarik otomatis: tiap tarikan
 *                                          menghubungi bank dan menulis log, jadi
 *                                          hanya lewat tombol "Cek saldo" (opsi
 *                                          query sama dengan Rekening BNI)
 *   - `GET /api/v1/transparency/ledger` → cadangan, Admin & Developer saja
 *   - saldo DurianPay: endpoint belum ada → "Belum tersedia", tanpa angka.
 */
export default function OverviewPage() {
  const { user } = useAuth()
  const showReserve = canManageSettings(user)
  const showOtcLink = canAccessRequestList(user)

  return (
    <div>
      <PageHeader
        title="Ringkasan"
        subtitle="Keadaan USDX hari ini dari data yang ada di backend. Saldo bank hanya diambil saat kamu menekan Cek saldo."
      />
      <div className="space-y-4">
        <NeedsActionCard />
        <div className="grid gap-4 lg:grid-cols-2">
          <TokenCard />
          <BniCard />
          {showReserve && <ReserveCard />}
          <GatewayCard />
        </div>
        <OtcCard showLink={showOtcLink} />
      </div>
    </div>
  )
}

// ─── Kerangka kartu ──────────────────────────────────────────────────────────

function Panel({
  title,
  description,
  action,
  children,
  testId,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <section
      className={cn('rounded-md border border-border bg-card px-5 py-4 sm:px-6 sm:py-5', className)}
      data-testid={testId}
      aria-label={title}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-section">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function BigFigure({ value, unit, testId }: { value: ReactNode; unit?: string; testId?: string }) {
  return (
    <p className="mt-1 text-money-lg tabular-nums" data-testid={testId}>
      {value}
      {unit && <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>}
    </p>
  )
}

function Row({ label, value, hint, testId }: { label: ReactNode; value: ReactNode; hint?: ReactNode; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border border-t border-border">{children}</div>
}

function GoTo({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  )
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="space-y-2" role="alert">
      <p className="text-sm text-destructive">{what} gagal dimuat.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Coba lagi
      </Button>
    </div>
  )
}

const id = (n: number) => n.toLocaleString('id-ID')

// ─── Perlu tindakan (queue-counts) ───────────────────────────────────────────

function NeedsActionCard() {
  const q = useQueueCounts()
  const c = q.data
  const total = c?.transactionsNeedsAction
  return (
    <Panel
      title="Perlu tindakan"
      description="Dari hitungan antrean — tanpa membuka data nasabah."
      testId="ringkasan-perlu-tindakan"
      action={<GoTo to="/transactions">Buka Transaksi</GoTo>}
    >
      {q.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : q.isError || !c ? (
        <LoadError what="Jumlah antrean" onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div>
            <BigFigure value={typeof total === 'number' ? id(total) : '—'} testId="ringkasan-transaksi-perlu-tindakan" />
            <p className="mt-1 text-xs text-muted-foreground">
              {typeof total === 'number'
                ? 'transaksi menunggu tindakan'
                : 'Backend belum mengirim jumlah transaksi yang perlu tindakan.'}
            </p>
          </div>
          <Rows>
            <Row label="Pencairan bermasalah" value={id(c.payoutFailuresOpen)} />
            <Row label="Pencairan menunggu persetujuan" value={id(c.redeemApprovalsOpen)} />
            {typeof c.heldCreditsOpen === 'number' && <Row label="Uang masuk tertahan" value={id(c.heldCreditsOpen)} />}
            {typeof c.approvalsOpen === 'number' && (
              <Row label={<Link to="/persetujuan" className="hover:underline">Persetujuan orang kedua</Link>} value={id(c.approvalsOpen)} />
            )}
          </Rows>
        </div>
      )}
    </Panel>
  )
}

// ─── Token & Safe (dashboard/stats) ──────────────────────────────────────────

function TokenCard() {
  const q = useDashboardStats()
  const s = q.data
  return (
    <Panel title="Token USDX" description="Dibaca dari blockchain Polygon lewat backend." testId="ringkasan-token">
      {q.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : q.isError || !s ? (
        <LoadError what="Data token" onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-label text-muted-foreground">Pasokan beredar</p>
            <BigFigure value={formatDecimalId(s.totalSupply)} unit="USDX" testId="ringkasan-pasokan" />
            <p className="mt-1 text-xs text-muted-foreground">Total token USDX di blockchain (on-chain, Polygon).</p>
          </div>
          <Rows>
            <Row label="Saldo Safe Staf" value={`${formatDecimalId(s.safeBalances.staff)} USDX`} />
            <Row label="Saldo Safe Manager" value={`${formatDecimalId(s.safeBalances.manager)} USDX`} />
            <Row label="Kurs beli berlaku" hint="Per 1 USDX" value={formatIdrRate(s.currentRate)} />
          </Rows>
        </div>
      )}
    </Panel>
  )
}

// ─── Rekening BNI (tarik manual) ─────────────────────────────────────────────

function BniCard() {
  const accounts = useBniAccounts()
  const list = accounts.data ?? []
  // Tidak ditarik saat halaman dibuka: tiap tarikan = satu InquiryBalance ke
  // BNI + baris activity_log/api_call_log. `useBniBalances` membawa opsi
  // Rekening BNI apa adanya (retry:false, staleTime:Infinity, tanpa refetch
  // fokus/reconnect, gcTime:0).
  const [requested, setRequested] = useState(false)
  const balances = useBniBalances(requested && accounts.isSuccess && list.length > 0)

  const onCheck = () => {
    if (!requested) setRequested(true)
    else void balances.refetch()
  }

  return (
    <Panel
      title="Rekening BNI"
      description={
        balances.data && !balances.error ? (
          <>
            Ditarik (WIB) <span className="tabular-nums" data-testid="ringkasan-bni-ditarik">{formatDateTime(balances.data.pulledAt)}</span>
          </>
        ) : (
          'Saldo langsung dari bank, hanya saat kamu memintanya.'
        )
      }
      testId="ringkasan-bni"
      action={
        list.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCheck}
            disabled={balances.isFetching}
            data-testid="ringkasan-cek-saldo"
          >
            {balances.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            {requested ? 'Cek ulang' : 'Cek saldo'}
          </Button>
        ) : undefined
      }
    >
      {accounts.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : accounts.isError ? (
        <LoadError what="Daftar rekening BNI" onRetry={() => void accounts.refetch()} />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada rekening BNI yang terpasang di sistem.</p>
      ) : (
        <BniRows accounts={list} requested={requested} balances={balances.data} error={balances.error} isPending={balances.isPending} />
      )}
      {list.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tiap pengecekan menghubungi BNI dan tercatat di log. <Link to="/bni-accounts" className="font-medium text-primary hover:underline">Mutasi di Rekening BNI</Link>
        </p>
      )}
    </Panel>
  )
}

function BniRows({
  accounts,
  requested,
  balances,
  error,
  isPending,
}: {
  accounts: BniAccount[]
  requested: boolean
  balances: BniBalances | undefined
  error: unknown
  isPending: boolean
}) {
  if (!requested) {
    return (
      <Rows>
        {accounts.map((a) => (
          <Row key={a.accountNo} label={a.label} hint={<span className="tabular-nums">{a.accountNo}</span>} value={<span className="font-normal text-muted-foreground">Belum dicek</span>} />
        ))}
      </Rows>
    )
  }
  const states = resolveBalanceCardStates(accounts, balances, error, isPending)
  return (
    <Rows>
      {accounts.map((a, i) => {
        const st = states[i]!
        const value =
          st.kind === 'loading' ? (
            <Skeleton className="h-4 w-28" />
          ) : st.kind === 'ok' ? (
            formatBankAmount(st.card.effectiveBalance ?? st.card.endingBalance, st.card.currency)
          ) : (
            <span className="font-normal text-destructive">{st.kind === 'unavailable' ? 'Tidak terbaca' : 'Ditolak bank'}</span>
          )
        const hint =
          st.kind === 'unavailable' ? st.error.message : st.kind === 'bank-rejected' ? st.text : st.kind === 'ok' ? 'Saldo efektif' : undefined
        return (
          <Row
            key={a.accountNo}
            testId={`ringkasan-bni-${a.role}`}
            label={a.label}
            hint={
              <>
                <span className="tabular-nums">{a.accountNo}</span>
                {hint ? ` · ${hint}` : ''}
              </>
            }
            value={value}
          />
        )
      })}
    </Rows>
  )
}

// ─── Cadangan (Admin & Developer) ────────────────────────────────────────────

function ReserveCard() {
  const q = useReserveLedger(1, 1)
  const balance = q.data?.balance
  return (
    <Panel
      title="Cadangan"
      description="Dicatat manual oleh admin, bukan saldo bank live."
      testId="ringkasan-cadangan"
      action={<GoTo to="/transparency">Buka Cadangan</GoTo>}
    >
      {q.isPending ? (
        <Skeleton className="h-10 w-40" />
      ) : q.isError || !balance ? (
        <LoadError what="Saldo cadangan" onRetry={() => void q.refetch()} />
      ) : (
        <>
          <BigFigure value={formatAmountDecimal(balance.amount)} unit={balance.currency} testId="ringkasan-cadangan-saldo" />
          <p className="mt-1 text-xs text-muted-foreground">Jumlah seluruh entri buku besar cadangan — angka yang tayang di usdx.co.id.</p>
        </>
      )}
    </Panel>
  )
}

// ─── Saldo payment gateway (belum ada endpoint) ─────────────────────────────

function GatewayCard() {
  return (
    <Panel title="Saldo payment gateway (DurianPay)" testId="ringkasan-durianpay">
      <p className="text-base font-medium text-muted-foreground">Belum tersedia</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Backend belum punya endpoint saldo DurianPay, jadi tidak ada angka yang ditampilkan di sini.
      </p>
    </Panel>
  )
}

// ─── OTC (dashboard/stats, khusus OTC) ───────────────────────────────────────

const OTC_STATUS_ORDER: Array<keyof DashboardStats['requestsByStatus']> = ['PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED']

function OtcCard({ showLink }: { showLink: boolean }) {
  const q = useDashboardStats()
  const s = q.data
  return (
    <Panel
      title="OTC"
      description="Khusus permintaan OTC (mint & redeem partner) — bukan transaksi nasabah di aplikasi."
      testId="ringkasan-otc"
      action={showLink ? <GoTo to="/otc/mint">Buka OTC</GoTo> : undefined}
    >
      {q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError || !s ? (
        <LoadError what="Data OTC" onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Rows>
            <Row label="USDX dicetak lewat mint OTC" hint="Permintaan berstatus Dieksekusi" value={`${formatDecimalId(s.totalMinted)} USDX`} />
            <Row label="USDX dibakar lewat redeem OTC" hint="Permintaan berstatus Dieksekusi" value={`${formatDecimalId(s.totalBurned)} USDX`} />
          </Rows>
          <Rows>
            {OTC_STATUS_ORDER.map((k) => (
              <Row key={k} testId={`ringkasan-otc-${k}`} label={getRequestStatusConfig(k).label} value={id(s.requestsByStatus[k])} />
            ))}
          </Rows>
        </div>
      )}
    </Panel>
  )
}
