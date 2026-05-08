import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ThresholdConfig, UpdateThresholdConfig } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

const THRESHOLD_QUERY_KEY = ['threshold'] as const

// SoT api/threshold.yaml § GET /api/v1/threshold — returns the current
// active config (latest row from append-only safe_threshold_configs).
export function useThreshold() {
  return useQuery({
    queryKey: THRESHOLD_QUERY_KEY,
    queryFn: () => apiFetch<ThresholdConfig>('/api/v1/threshold'),
  })
}

// SoT phase-1.md § Threshold Configuration L78: only Admin can update.
// API returns 403 for non-admin per sot/api/threshold.yaml.
export function useUpdateThreshold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateThresholdConfig) =>
      apiFetch<ThresholdConfig>('/api/v1/threshold', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: THRESHOLD_QUERY_KEY })
    },
  })
}
