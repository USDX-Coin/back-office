import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { OtcMintTransaction, OtcRedeemTransaction, PaginatedResponse } from '@/lib/types'

const POLL_INTERVAL_MS = 5000

type OtcTx = OtcMintTransaction | OtcRedeemTransaction

/**
 * Shared query + polling hook for OTC recent lists. Polls every 5s while any
 * row is pending; auto-disables when all rows are terminal. Fires a single
 * settlement toast per row as it transitions to completed/failed, tracked via
 * a local useRef<Set<string>> to prevent duplicate toasts across refetches.
 */
export function usePendingSettlementPolling<T extends OtcTx>(
  queryKey: readonly unknown[],
  endpoint: string,
  kindLabel: 'Mint' | 'Redeem'
): UseQueryResult<PaginatedResponse<T>> {
  const qc = useQueryClient()
  const toastedRef = useRef<Set<string>>(new Set())

  const query = useQuery<PaginatedResponse<T>>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Failed to fetch ${kindLabel.toLowerCase()}s`)
      return res.json()
    },
    refetchInterval: (q) => {
      const data = q.state.data as PaginatedResponse<T> | undefined
      const hasPending = data?.data.some((r) => r.status === 'pending') ?? false
      return hasPending ? POLL_INTERVAL_MS : false
    },
  })

  // Fire settlement toasts for newly-terminal rows, deduped via ref.
  useEffect(() => {
    const rows = query.data?.data
    if (!rows) return
    for (const row of rows) {
      if (row.status === 'pending') continue
      if (toastedRef.current.has(row.id)) continue
      toastedRef.current.add(row.id)
      if (row.status === 'completed') {
        toast.success(`${kindLabel} completed`, {
          description: `${row.amount.toLocaleString()} USDX · ${row.network}`,
        })
      } else if (row.status === 'failed') {
        toast.error(`${kindLabel} failed`, {
          description: `${row.amount.toLocaleString()} USDX · ${row.network}`,
        })
      }
      // Invalidate dashboard snapshot so KPIs reflect the new terminal state
      qc.invalidateQueries({ queryKey: ['dashboard', 'snapshot'] })
    }
  }, [query.data, kindLabel, qc])

  return query
}
