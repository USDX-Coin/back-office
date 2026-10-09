import { canAccessRequestList, useAuth } from '@/lib/auth'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { useOtcActionCount } from '@/features/otc/hooks'
import { usePendingKycCount } from '@/features/kyc/hooks'
import { usePendingKybCount } from '@/features/kyb/hooks'
import { useOpenScreeningCount } from '@/features/screening/hooks'
import type { QueueCounts } from '@/lib/types'
import type { BadgeKey } from './navItems'

/**
 * Angka satu menu. `unknown` = sedikitnya satu bagian angkanya BELUM TERBACA
 * (query gagal, atau backend belum mengirim kuncinya) — dan itu jawaban yang
 * berbeda dari nol. Antrean rupiah yang tak terbaca tidak boleh terlihat sama
 * dengan antrean yang bersih.
 */
export interface BadgeValue {
  count: number
  unknown: boolean
}

export const EMPTY_BADGE: BadgeValue = { count: 0, unknown: false }

export function sumBadges(values: BadgeValue[]): BadgeValue {
  return values.reduce(
    (acc, v) => ({ count: acc.count + v.count, unknown: acc.unknown || v.unknown }),
    EMPTY_BADGE,
  )
}

/**
 * Semua angka menu dari satu tempat — dipakai Sidebar, laci menu ponsel, dan
 * titik di tombol hamburger, supaya ketiganya tidak pernah berbeda.
 */
export function useNavBadges(): (key?: BadgeKey) => BadgeValue {
  const { user } = useAuth()
  // STAFF tidak boleh membaca /api/v1/requests (sot/phase-1.md L34) — query
  // OTC tidak dijalankan sama sekali, alih-alih menghasilkan 403 berisik.
  const canSeeOtc = canAccessRequestList(user)
  const otc = useOtcActionCount({ enabled: canSeeOtc })
  const kyc = usePendingKycCount()
  const kyb = usePendingKybCount()
  const screening = useOpenScreeningCount()
  // USDX-678 — satu request `GET /api/v1/queue-counts` untuk semua antrean
  // yang list-nya mendekripsi PII. Tidak pernah list `take=1`.
  const queueCounts = useQueueCounts()

  const fromQuery = (q: { data?: number; isError: boolean }): BadgeValue =>
    q.isError ? { count: 0, unknown: true } : { count: q.data ?? 0, unknown: false }

  const fromCounts = (pick: (c: QueueCounts) => number | undefined): BadgeValue => {
    if (queueCounts.isError) return { count: 0, unknown: true }
    if (!queueCounts.data) return EMPTY_BADGE
    const n = pick(queueCounts.data)
    // Kunci yang HILANG dari jawaban juga "belum terbaca", bukan nol.
    return typeof n === 'number' ? { count: n, unknown: false } : { count: 0, unknown: true }
  }

  return (key) => {
    switch (key) {
      case 'transactions':
        // ⚠️ DRAF SOT PR #50: badge = `transactionsNeedsAction` (per baris, tidak
        // dijumlah dari antrean lain). Kunci absen ⇒ badge disembunyikan (kontrak).
        if (queueCounts.isError) return { count: 0, unknown: true }
        return typeof queueCounts.data?.transactionsNeedsAction === 'number'
          ? { count: queueCounts.data.transactionsNeedsAction, unknown: false }
          : EMPTY_BADGE
      case 'otc':
        return canSeeOtc ? fromQuery(otc) : EMPTY_BADGE
      case 'verification':
        return sumBadges([fromQuery(kyc), fromQuery(kyb)])
      case 'screening':
        return fromQuery(screening)
      case 'approvals':
        return fromCounts((c) => c.approvalsOpen)
      default:
        return EMPTY_BADGE
    }
  }
}
