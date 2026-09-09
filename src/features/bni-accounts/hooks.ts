import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { BniAccount, BniBalances, BniStatement, BniStatementType } from '@/lib/types'

// USDX-631 — sot/api/bni-accounts.yaml + sot/bni-integration.md § 16.4
// "Perilaku query". Every bank-touching query opts OUT of the app defaults:
//   retry: false            — default `retry: 1` = each failure is TWO bank
//                             calls + two activity_log rows.
//   staleTime: Infinity     — nothing refetches on its own; "Tarik" is the
//                             only trigger.
//   refetchOnWindowFocus /
//   refetchOnReconnect: false
//   gcTime: 0               — the next operator on the same tab must not
//                             inherit the previous operator's figures (there is
//                             no queryClient.clear() on logout).
// Browser timeout 45 s sits above backend 35 s above service 15 s (§ 16.2).

const BNI_BROWSER_TIMEOUT_MS = 45_000

export const bniAccountsKeys = {
  all: ['bni-accounts'] as const,
  list: () => [...bniAccountsKeys.all, 'list'] as const,
  balances: () => [...bniAccountsKeys.all, 'balances'] as const,
  statement: (params: BniStatementParams) =>
    [...bniAccountsKeys.all, 'statement', params] as const,
}

const BANK_QUERY_OPTIONS = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  gcTime: 0,
} as const

// `AbortSignal.timeout` is standard in every browser we ship to; jsdom in
// Vitest may lack it, so fall back to no timeout there rather than crash.
function bankRequestSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(BNI_BROWSER_TIMEOUT_MS)
    : undefined
}

function fetchBniAccounts(): Promise<BniAccount[]> {
  return apiFetch<BniAccount[]>('/api/v1/bni-accounts')
}

/** Env-configured accounts — no bank call, so plain caching is fine (§ 16 F4). */
export function useBniAccounts() {
  return useQuery({
    queryKey: bniAccountsKeys.list(),
    queryFn: fetchBniAccounts,
    staleTime: Infinity,
  })
}

function fetchBniBalances(): Promise<BniBalances> {
  return apiFetch<BniBalances>('/api/v1/bni-accounts/balances', {
    signal: bankRequestSignal(),
  })
}

/** One InquiryBalance for every configured account; `enabled` = list non-empty. */
export function useBniBalances(enabled: boolean) {
  return useQuery({
    queryKey: bniAccountsKeys.balances(),
    queryFn: fetchBniBalances,
    enabled,
    ...BANK_QUERY_OPTIONS,
  })
}

export interface BniStatementParams {
  accountNo: string
  startDate: string
  endDate: string
  type: BniStatementType
}

export function buildBniStatementPath(params: BniStatementParams): string {
  const sp = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
    type: params.type,
  })
  return `/api/v1/bni-accounts/${encodeURIComponent(params.accountNo)}/statement?${sp.toString()}`
}

function fetchBniStatement(params: BniStatementParams): Promise<BniStatement> {
  return apiFetch<BniStatement>(buildBniStatementPath(params), {
    signal: bankRequestSignal(),
  })
}

/**
 * Keyed on the APPLIED params (the snapshot taken when "Tarik" was pressed),
 * never on the live form — a `useQuery`, not a `useMutation`, so the result
 * survives re-renders and `refetch()` is the explicit re-pull.
 */
export function useBniStatement(params: BniStatementParams | null) {
  return useQuery({
    queryKey: params ? bniAccountsKeys.statement(params) : [...bniAccountsKeys.all, 'statement', 'idle'],
    queryFn: () => fetchBniStatement(params as BniStatementParams),
    enabled: params !== null,
    ...BANK_QUERY_OPTIONS,
  })
}
