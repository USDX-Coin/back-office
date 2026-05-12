import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { ChainConfig } from '@/lib/types'

// GET /api/v1/chains (sot/api/chains.yaml) — SuccessResponse-wrapped array, so
// apiFetch (which unwraps `data`) returns ChainConfig[] directly.
async function fetchChains(): Promise<ChainConfig[]> {
  return apiFetch<ChainConfig[]>('/api/v1/chains')
}

/**
 * Supported chain configs (block explorer + Safe addresses), used by Mint/Burn
 * list rows and the request detail modal to build on-chain deep-links. Config
 * changes rarely → long staleTime. Consumers must degrade gracefully when this
 * is unavailable (links hidden / fallback to copyable text).
 *
 * Pure helpers that operate on the result live in `@/lib/chainLinks`
 * (`findChainConfig`, `resolveOnChainLinks`).
 */
export function useChainConfig() {
  return useQuery({
    queryKey: ['chains'],
    queryFn: fetchChains,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
