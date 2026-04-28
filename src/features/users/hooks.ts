import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Customer, CustomerSummary, PaginatedResponse } from '@/lib/types'

interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  type?: string
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

async function fetchCustomers(params: ListParams): Promise<PaginatedResponse<Customer>> {
  const res = await fetch(`/api/customers?${buildQuery(params)}`)
  if (!res.ok) throw new Error('Failed to fetch customers')
  return res.json()
}

async function fetchCustomerSummary(): Promise<CustomerSummary> {
  const res = await fetch('/api/customers/summary')
  if (!res.ok) throw new Error('Failed to fetch customer summary')
  return res.json()
}

export function useCustomers(params: ListParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers(params),
  })
}

export function useCustomerSummary() {
  return useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: fetchCustomerSummary,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Customer, 'id' | 'createdAt'>) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(err?.error?.message ?? 'Failed to create customer')
      }
      return res.json() as Promise<Customer>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Customer> }) => {
      const res = await fetch(`/api/customers/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.patch),
      })
      if (!res.ok) throw new Error('Failed to update customer')
      return res.json() as Promise<Customer>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete customer')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
