import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RateConfig, RateInfo, UpdateRateConfig } from '@/lib/types'

// SoT envelope (sot/openapi.yaml § SuccessResponse). Extra fields are
// ignored on the client, but typed so the contract is explicit.
interface DataEnvelope<T> {
  status: 'success'
  metadata: null | object
  data: T
}

const RATE_QUERY_KEY = ['rate'] as const

export function useRate() {
  return useQuery({
    queryKey: RATE_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/v1/rate')
      if (!res.ok) throw new Error('Failed to load rate')
      const json = (await res.json()) as DataEnvelope<RateInfo>
      return json.data
    },
  })
}

interface UpdateRateInput extends UpdateRateConfig {
  operatorStaffId: string
}

export function useUpdateRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateRateInput) => {
      const res = await fetch('/api/v1/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(err?.error?.message ?? 'Failed to update rate')
      }
      const json = (await res.json()) as DataEnvelope<RateConfig>
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RATE_QUERY_KEY })
    },
  })
}
