import type { BniAccount, BniBalanceCard, BniBalances } from '@/lib/types'
import { describeBniError, type BniErrorView } from './errors'

// USDX-631 — pure state resolution for the three balance cards
// (sot/bni-integration.md § 16.4). Kept out of BalanceCards.tsx so the
// component file stays Fast-Refresh clean and this logic is unit-testable
// without rendering.

export type BalanceCardState =
  | { kind: 'loading' }
  | { kind: 'ok'; card: BniBalanceCard }
  | { kind: 'bank-rejected'; card: BniBalanceCard; text: string }
  | { kind: 'unavailable'; error: BniErrorView }

// § 16.3: the bank's business text (`errorReason`) is shown for REJECTED; the
// backend already writes the operator text for BLOCKED / MISSING /
// NOT_ALLOWED into `errorReason` (cardErrorReason, backend PR #305). These are
// the fallbacks when it is empty — and the default branch keeps the enum OPEN.
// § 16.3 text rule: the bank's `errorReason` may be shown for HTTP 200/400
// replies; on 401/403/5xx it is misleading (T2: the credentials text) and the
// backend must not forward it. Enforce the same rule here as defence in depth.
function reasonAllowed(httpStatus: number | null | undefined): boolean {
  return httpStatus == null || httpStatus === 200 || httpStatus === 400
}

function rejectedText(card: BniBalanceCard): string {
  const reason = card.errorReason?.trim()
  if (reason && reasonAllowed(card.httpStatus)) return reason
  switch (card.status) {
    case 'BLOCKED':
      return 'Bank menjawab HTTP 400 tanpa alasan (indikasi rekening diblokir).'
    case 'MISSING':
      return 'Bank tidak mengembalikan rekening ini.'
    case 'NOT_ALLOWED':
      return 'Rekening belum diizinkan di layanan bank (periksa konfigurasi).'
    case 'REJECTED':
      return 'Ditolak bank tanpa alasan.'
    default:
      return `Status bank: ${String(card.status)}.`
  }
}

/** Pure — one state per configured account (unit-tested through the page). */
export function resolveBalanceCardStates(
  accounts: readonly BniAccount[],
  balances: BniBalances | undefined,
  error: unknown,
  isPending: boolean
): BalanceCardState[] {
  if (error) {
    const view = describeBniError(error)
    return accounts.map(() => ({ kind: 'unavailable', error: view }))
  }
  if (isPending || !balances) return accounts.map(() => ({ kind: 'loading' }))
  return accounts.map((account) => {
    const card = balances.accounts.find((c) => c.accountNo === account.accountNo)
    if (!card) {
      return {
        kind: 'bank-rejected',
        card: { ...account, status: 'MISSING', errorReason: null },
        text: 'Bank tidak mengembalikan rekening ini.',
      }
    }
    if (card.status === 'OK') return { kind: 'ok', card }
    return { kind: 'bank-rejected', card, text: rejectedText(card) }
  })
}
