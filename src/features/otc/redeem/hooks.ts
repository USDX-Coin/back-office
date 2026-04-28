import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OtcRedeemTransaction } from '@/lib/types'
import { usePendingSettlementPolling } from '../hooks'

export function useRecentRedeems() {
  return usePendingSettlementPolling<OtcRedeemTransaction>(
    ['otc', 'redeem', 'recent'],
    '/api/otc/redeem?page=1&pageSize=5',
    'Redeem'
  )
}

interface CreateRedeemInput {
  customerId: string
  operatorStaffId: string
  network: string
  amount: number
}

export function useCreateRedeem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateRedeemInput) => {
      const res = await fetch('/api/otc/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(err?.error?.message ?? 'Failed to submit redemption')
      }
      return res.json() as Promise<OtcRedeemTransaction>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['otc', 'redeem'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'snapshot'] })
    },
  })
}
