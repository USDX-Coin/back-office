import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RateConfig, RateInfo, UpdateRateConfig } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

const RATE_QUERY_KEY = ['rate'] as const

export function useRate() {
  return useQuery({
    queryKey: RATE_QUERY_KEY,
    queryFn: () => apiFetch<RateInfo>('/api/v1/rate'),
  })
}

export function useUpdateRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateRateConfig) =>
      apiFetch<RateConfig>('/api/v1/rate', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RATE_QUERY_KEY })
    },
  })
}
