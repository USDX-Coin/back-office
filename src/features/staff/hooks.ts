import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Staff } from '@/lib/types'

export interface StaffListFilters {
  page?: number
  limit?: number
}

// Reads from real BE per sot/openapi.yaml § /api/v1/staff (USDX-41).
// CRUD (POST/PATCH/DELETE) is out of scope for USDX-41 — separate ticket.
export function useStaff(filters: StaffListFilters = {}) {
  return useQuery({
    queryKey: ['staff', filters],
    queryFn: async () =>
      apiFetch<Staff[]>('/api/v1/staff', {
        query: {
          page: filters.page,
          limit: filters.limit,
        },
      }),
  })
}
