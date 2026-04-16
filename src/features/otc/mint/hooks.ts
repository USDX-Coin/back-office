import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OtcMintTransaction, PaginatedResponse } from '@/lib/types'
import { usePendingSettlementPolling } from '../hooks'

export function useRecentMints() {
  return usePendingSettlementPolling<OtcMintTransaction>(
    ['otc', 'mint', 'recent'],
    '/api/otc/mint?page=1&pageSize=5',
    'Mint'
  )
}

export function useOtcMintList(params: { page?: number; pageSize?: number } = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  return usePendingSettlementPolling<OtcMintTransaction>(
    ['otc', 'mint', 'list', { page, pageSize }],
    `/api/otc/mint?page=${page}&pageSize=${pageSize}`,
    'Mint'
  )
}

interface CreateMintInput {
  customerId: string
  operatorStaffId: string
  network: string
  amount: number
  destinationAddress: string
  notes?: string
}

export function useCreateMint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMintInput) => {
      const res = await fetch('/api/otc/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(err?.error?.message ?? 'Failed to submit mint')
      }
      return res.json() as Promise<OtcMintTransaction>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['otc', 'mint'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'snapshot'] })
    },
  })
}

export type { PaginatedResponse }
