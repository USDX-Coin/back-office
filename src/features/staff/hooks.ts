// USDX-41 wired GET listing. USDX-48 added create/update/deactivate per
// sot/api/staff.yaml — admin-only endpoints, BE returns 403 for non-admin.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type {
  CreateStaff,
  PhaseOnePaginatedResponse,
  Staff,
  UpdateStaff,
} from '@/lib/types'

interface ListParams {
  page?: number
  limit?: number
}

function buildQuery(params: ListParams): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

// Returns the full envelope so consumers can paginate via metadata.total.
export function useStaff(params: ListParams = {}) {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<Staff>>(
        `/api/v1/staff${buildQuery(params)}`
      ),
  })
}

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStaff) =>
      apiFetch<Staff>('/api/v1/staff', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateStaff }) =>
      apiFetch<Staff>(`/api/v1/staff/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

// Soft delete: server flips isActive to false (sot/api/staff.yaml — DELETE
// 200, "Staff deactivated"). The row stays in the list with an Inactive badge.
export function useDeactivateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}
