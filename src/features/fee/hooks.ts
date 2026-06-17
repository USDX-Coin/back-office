import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeeConfig, UpdateFeeConfig } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

// USDX-207 — fee config (sot/api/fee.yaml § /api/v1/fee-config). Append-only;
// the latest row is the active config. GET = all backoffice roles; POST = admin.

const FEE_CONFIG_QUERY_KEY = ['fee-config'] as const

export function useFeeConfig() {
  return useQuery({
    queryKey: FEE_CONFIG_QUERY_KEY,
    queryFn: () => apiFetch<FeeConfig>('/api/v1/fee-config'),
  })
}

export function useUpdateFeeConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFeeConfig) =>
      apiFetch<FeeConfig>('/api/v1/fee-config', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEE_CONFIG_QUERY_KEY })
    },
  })
}
