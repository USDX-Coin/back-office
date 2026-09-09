import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusPill from '@/components/StatusPill'
import { formatBankAmount, formatBniPostDate, formatWibDateTime } from '@/lib/format'
import { getBniBalanceCardStatusConfig } from '@/lib/status'
import type { BniAccount, BniBalances } from '@/lib/types'
import { cn } from '@/lib/utils'
import { resolveBalanceCardStates, type BalanceCardState } from './balanceCardState'

// USDX-631 — sot/bni-integration.md § 16.4 "Kartu saldo". Every card resolves
// to exactly one of `loading | ok | bank-rejected | unavailable` — never a
// spinner without an end (lesson from the multisig owner-check hang). Labels
// come from `GET /bni-accounts`, so a card still names its account when the
// bank call failed (§ 16 F4). One "Tarik ulang saldo" for all three cards —
// a single InquiryBalance carries the whole `accountList`.

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[18px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}

function BalanceCardView({
  account,
  state,
}: {
  account: BniAccount
  state: BalanceCardState
}) {
  return (
    <Card
      className="rounded-md py-0 gap-0 shadow-none dark:border-0"
      data-testid={`bni-balance-card-${account.role}`}
      data-state={state.kind}
    >
      <CardContent className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{account.label}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{account.accountNo}</p>
          </div>
          {(state.kind === 'ok' || state.kind === 'bank-rejected') && (
            <StatusPill cfg={getBniBalanceCardStatusConfig(state.card.status)} />
          )}
        </div>

        {state.kind === 'loading' && (
          <div className="mt-3 space-y-2" aria-busy="true" aria-label="Memuat saldo">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
          </div>
        )}

        {state.kind === 'unavailable' && (
          <p className="mt-3 text-[12.5px] text-destructive" role="status">
            {state.error.message}
          </p>
        )}

        {state.kind === 'bank-rejected' && (
          <p className="mt-3 text-[12.5px] text-destructive" role="status">
            {state.text}
          </p>
        )}

        {(state.kind === 'ok' || state.kind === 'bank-rejected') &&
          (state.card.effectiveBalance != null || state.card.endingBalance != null) && (
            <div
              className={cn(
                'mt-3 grid grid-cols-2 gap-3',
                state.kind === 'bank-rejected' && 'opacity-70'
              )}
            >
              {/* Both balances, both labelled — which one is "the" balance is
                  not confirmed by BNI (§ 13), so the UI does not choose. */}
              <Amount
                label="Saldo efektif"
                value={formatBankAmount(state.card.effectiveBalance, state.card.currency)}
              />
              <Amount
                label="Saldo akhir"
                value={formatBankAmount(state.card.endingBalance, state.card.currency)}
              />
            </div>
          )}

        {state.kind === 'ok' && (
          <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">
            {[state.card.accountName, state.card.accountType, state.card.currency]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface Props {
  accounts: readonly BniAccount[]
  balances: BniBalances | undefined
  error: unknown
  isPending: boolean
  isFetching: boolean
  onRefetch: () => void
}

export default function BalanceCards({
  accounts,
  balances,
  error,
  isPending,
  isFetching,
  onRefetch,
}: Props) {
  const states = resolveBalanceCardStates(accounts, balances, error, isPending)

  return (
    <section aria-labelledby="bni-balances-heading" className="mb-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="bni-balances-heading" className="text-[15px] font-semibold tracking-tight">
            Saldo rekening
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {balances && !error ? (
              <>
                Menurut bank:{' '}
                <span className="font-mono" data-testid="bni-inquired-at-bank">
                  {formatBniPostDate(balances.inquiredAtBank)}
                </span>{' '}
                WIB · Tarikan:{' '}
                <span className="font-mono" data-testid="bni-pulled-at">
                  {formatWibDateTime(balances.pulledAt)}
                </span>
              </>
            ) : (
              'Saldo LIVE dari BNIdirect — tidak diperbarui otomatis.'
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefetch}
          disabled={isFetching}
          data-testid="bni-refetch-balances"
        >
          {isFetching ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Tarik ulang saldo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account, i) => (
          <BalanceCardView key={account.accountNo} account={account} state={states[i]!} />
        ))}
      </div>
    </section>
  )
}
