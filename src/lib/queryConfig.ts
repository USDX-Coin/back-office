// Desk-wide server-state configuration: the QueryClient defaults, the polling
// cadences, and the cross-feature invalidation fan-out.
//
// WHY THIS IS ONE SHARED FILE AND NOT A SETTING PER HOOK
//
// The back office is an operations desk. An operator watching a mint has to see
// what actually happened without pressing refresh — that is the product, not a
// nicety. Two settings used to prevent it, and only one of them was per-hook:
//
//  1. A global `staleTime: 60s` (App.tsx). TanStack Query only refetches a
//     query it considers STALE, so a 60s staleTime silently disabled
//     `refetchOnWindowFocus` desk-wide: returning to the tab within a minute
//     fetched nothing. Worse, it made a re-mounted view replay a minute-old
//     snapshot — re-opening the multisig detail drawer rendered the cached
//     "1/2 signatures · Sign (EIP-712)" state for a transaction the queue
//     behind it already showed as Confirming.
//  2. Poll intervals of 20s, hard-coded in each feature's hooks.
//
// (1) is a single shared default; fixing it per hook would have been fixing the
// same bug fifteen times. (2) stays per hook — a list and an open detail panel
// genuinely deserve different cadences — but the NUMBERS live here so the desk's
// total request budget is one readable thing instead of fifteen magic numbers.
//
// THE BUDGET
//
// `sot/conventions.md` § Rate Limiting (Redis) documents a 5 req/s per-user
// throughput throttle on a 1-second fixed window, and instructs the FE to keep
// status-tracker polling at >= 1s with backoff on 429. The cadences below sit an
// order of magnitude under that ceiling, and every one of them is gated at the
// call site on "is anything still in flight?" — a settled row stops polling
// entirely (isSafeTxTerminal / isOrderTerminal / isRequestTerminal). An idle
// desk with a fully-settled queue makes ZERO background requests.

import type { QueryClient } from '@tanstack/react-query'

/**
 * Defaults for the app QueryClient (App.tsx) and the test client
 * (src/test/test-utils.tsx), so tests exercise the configuration that ships.
 */
export const QUERY_DEFAULTS = {
  // 0 = TanStack's own default, restored deliberately. Operational data is
  // never "fresh enough" to skip a refetch: mounting a view or coming back to
  // the tab is exactly the moment the operator is asking "what is true now?".
  // Queries that really are near-static override this locally and should keep
  // doing so — chain config (1h), Safe owners/threshold (5m), decrypted KYC
  // detail (Infinity), the sidebar pending badges (30s).
  staleTime: 0,
  refetchOnWindowFocus: true,
  retry: 1,
} as const

/**
 * The thing the operator is actively watching right now: an open detail panel
 * and the queue it was opened from.
 *
 * 5s, not the checkout app's 3s: checkout tracks ONE order on screen, while a
 * desk page holds five or six concurrent queries. At 3s the multisig page alone
 * would spend ~100 req/min and burst six requests into a single 1s throttle
 * window; 5s lands in the same "feels live" band for a human watching a status
 * badge, at roughly half the cost.
 */
export const POLL_ACTIVE_MS = 5_000

/**
 * Background lists on the current page — the operator sees them, but is not
 * holding their breath over one row. Also refetched on focus and after every
 * mutation, so 10s is the worst case, not the typical one.
 */
export const POLL_LIST_MS = 10_000

/**
 * Secondary counters and badges (multisig tab counts). Decoration rather than
 * the number an operator acts on, and multiplied by one query per counted
 * status — so this is the cadence that gets the longest leash.
 */
export const POLL_BADGE_MS = 15_000

/**
 * Every view that renders the SAME money event as a Safe transaction.
 *
 * One mint is shown in four places: the multisig queue, the consumer order list
 * (`/transactions` → `['orders']`), the OTC mint/burn lists plus their sidebar
 * pending badges (`['mint']`, `['burn']`, `['requests']`), and the dashboard
 * KPIs. A mutation that invalidates only its own feature leaves the other three
 * replaying the pre-action world until their own poll comes round — which is
 * how the desk kept showing "Waiting for payment" for a mint that had already
 * been signed and executed on the multisig page.
 *
 * Manual Sync already fanned out this way by hand (features/manual-sync/hooks.ts);
 * this makes it the shared rule instead of one feature's good habit.
 */
export const MONEY_FLOW_QUERY_KEYS: string[][] = [
  ['orders'],
  ['requests'],
  ['mint'],
  ['burn'],
  ['dashboard'],
]

/**
 * Invalidate every consumer view of a money event. Cheap by construction:
 * `invalidateQueries` refetches only queries that are currently MOUNTED, so an
 * operator sitting on /multisig pays for the multisig queries and marks the
 * rest stale — they refetch when (and if) that page is next opened.
 */
export function invalidateMoneyFlowViews(qc: QueryClient): void {
  for (const queryKey of MONEY_FLOW_QUERY_KEYS) {
    void qc.invalidateQueries({ queryKey })
  }
}
