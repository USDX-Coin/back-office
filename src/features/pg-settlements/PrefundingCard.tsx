import { useState } from 'react'
import { Link } from 'react-router'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBniAccounts, useBniBalances } from '@/features/bni-accounts/hooks'
import { resolveBalanceCardStates } from '@/features/bni-accounts/balanceCardState'
import { formatBankAmount, formatDateTime } from '@/lib/format'
import { isBelowPrefundingLow } from '@/lib/pgSettlements'
import { formatIdrExact } from '@/lib/redeemApprovals'
import { usePgSettlementSettings } from './hooks'

/**
 * Kartu saldo prefunding NP IDR (§ 21.8 "Saldo prefunding"): saldo rekening
 * `TREASURY_NP` dari `GET /bni-accounts/balances` (§ 16) + batas `prefundingLowIdr`.
 *
 * Saldo TIDAK ditarik saat halaman dibuka — tiap tarikan = satu InquiryBalance ke
 * BNI + baris log (pola kartu Rekening BNI di Ringkasan). Ops menekan "Cek saldo".
 */
export default function PrefundingCard() {
  const accounts = useBniAccounts()
  const np = (accounts.data ?? []).filter((a) => a.role === 'TREASURY_NP')
  const [requested, setRequested] = useState(false)
  const balances = useBniBalances(requested && accounts.isSuccess && np.length > 0)
  const settings = usePgSettlementSettings()
  const low = settings.data?.prefundingLowIdr ?? null

  const state = requested ? resolveBalanceCardStates(np, balances.data, balances.error, balances.isPending)[0] : undefined
  const balance = state?.kind === 'ok' ? (state.card.effectiveBalance ?? state.card.endingBalance ?? null) : null
  const below = isBelowPrefundingLow(balance, low)

  return (
    <Card className="mb-6 rounded-md shadow-none dark:border-0" data-testid="prefunding-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-section">Saldo prefunding NP IDR</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sumber dana setiap swap IDR→USD. Dana Durianpay T+1 masuk ke rekening yang sama dan mengisinya ulang.
          </p>
        </div>
        {np.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (requested ? void balances.refetch() : setRequested(true))}
            disabled={balances.isFetching}
          >
            {balances.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            {requested ? 'Cek ulang' : 'Cek saldo'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {accounts.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : accounts.isError ? (
          <p className="text-sm text-destructive">Daftar rekening BNI gagal dimuat.</p>
        ) : np.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rekening NP IDR belum terpasang di sistem.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {np[0]!.label} · <span className="tabular-nums">{np[0]!.accountNo}</span>
              </dt>
              <dd className="mt-1" data-testid="prefunding-balance">
                {!requested ? (
                  <span className="text-sm text-muted-foreground">Belum dicek</span>
                ) : !state || state.kind === 'loading' ? (
                  <Skeleton className="h-7 w-40" />
                ) : state.kind === 'ok' ? (
                  <span className="text-money-lg tabular-nums">{formatBankAmount(balance, state.card.currency)}</span>
                ) : (
                  <span className="text-sm text-destructive">
                    {state.kind === 'unavailable' ? state.error.message : state.text}
                  </span>
                )}
              </dd>
              {requested && balances.data && !balances.error && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saldo efektif · ditarik (WIB) <span className="tabular-nums">{formatDateTime(balances.data.pulledAt)}</span>
                </p>
              )}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Batas peringatan</dt>
              <dd className="mt-1 text-sm tabular-nums" data-testid="prefunding-low">
                {settings.isPending ? '…' : settings.isError ? 'Tidak terbaca' : low ? formatIdrExact(low) : 'Tidak ada peringatan'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Keadaan</dt>
              <dd className="mt-1 text-sm" data-testid="prefunding-state">
                {below === true ? (
                  <span className="font-medium text-destructive">Di bawah batas — isi ulang prefunding</span>
                ) : below === false ? (
                  <span className="text-success">Di atas batas</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Batas diatur di{' '}
          <Link to="/settings/payment-gateway" className="font-medium text-primary hover:underline">
            Pengaturan → Payment Gateway
          </Link>
          . Tiap pengecekan menghubungi BNI dan tercatat di log.
        </p>
      </CardContent>
    </Card>
  )
}
