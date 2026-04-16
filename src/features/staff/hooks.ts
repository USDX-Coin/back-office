import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginatedResponse, Staff, StaffSummary } from '@/lib/types'

interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  sortBy?: string
  sortOrder?: string
}

function buildQuery(params: ListParams): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

export function useStaff(params: ListParams = {}) {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: async () => {
      const res = await fetch(`/api/staff?${buildQuery(params)}`)
      if (!res.ok) throw new Error('Failed to fetch staff')
      return res.json() as Promise<PaginatedResponse<Staff>>
    },
  })
}

export function useStaffSummary() {
  return useQuery({
    queryKey: ['staff', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/staff/summary')
      if (!res.ok) throw new Error('Failed to fetch staff summary')
      return res.json() as Promise<StaffSummary>
    },
  })
}

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Staff, 'id' | 'createdAt' | 'displayName'>) => {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(err?.error?.message ?? 'Failed to create staff')
      }
      return res.json() as Promise<Staff>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Staff> }) => {
      const res = await fetch(`/api/staff/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.patch),
      })
      if (!res.ok) throw new Error('Failed to update staff')
      return res.json() as Promise<Staff>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete staff')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}
