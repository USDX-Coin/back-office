import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { Staff } from '@/lib/types'

interface ListParams {
  page?: number
  limit?: number
}

function buildQuery(params: ListParams): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

// Reads from real BE per sot/openapi.yaml § /api/v1/staff (USDX-41).
// CRUD (POST/PATCH/DELETE) is out of scope — separate ticket if needed.
export function useStaff(params: ListParams = {}) {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: () => apiFetch<Staff[]>(`/api/v1/staff?${buildQuery(params)}`),
  })
}
