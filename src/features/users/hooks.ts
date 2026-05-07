// USDX-37 — Wires the Users page to the real BE.
// Endpoints: sot/openapi.yaml § /api/v1/users + /api/v1/users/:id/wallets

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type {
  Customer,
  CustomerSummary,
  Network,
  PaginatedResponse,
  PhaseOneCreateUser,
  PhaseOneCreateUserWallet,
  PhaseOnePaginatedResponse,
  PhaseOneUpdateUser,
  PhaseOneUser,
  PhaseOneUserDetail,
  PhaseOneUserWallet,
  UserWallet,
} from '@/lib/types'

export interface UsersListParams {
  page?: number
  limit?: number
  search?: string
}

function buildQuery(params: UsersListParams): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

// Returns the full envelope so consumers can paginate using `metadata.total`.
export function useUsers(params: UsersListParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<PhaseOneUser>>(
        `/api/v1/users${buildQuery(params)}`
      ),
  })
}

export function useUserDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => apiFetch<PhaseOneUserDetail>(`/api/v1/users/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PhaseOneCreateUser) =>
      apiFetch<PhaseOneUser>('/api/v1/users', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PhaseOneUpdateUser }) =>
      apiFetch<PhaseOneUser>(`/api/v1/users/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['users', 'detail', variables.id] })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useAddWallet(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PhaseOneCreateUserWallet) => {
      if (!userId) throw new Error('Missing user id')
      return apiFetch<PhaseOneUserWallet>(
        `/api/v1/users/${userId}/wallets`,
        { method: 'POST', body: input }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useRemoveWallet(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (walletId: string) => {
      if (!userId) throw new Error('Missing user id')
      return apiFetch<void>(
        `/api/v1/users/${userId}/wallets/${walletId}`,
        { method: 'DELETE' }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ─── Legacy mock-only hooks ─────────────────────────────────────────────────
// `Customer` is the FE mock-domain (firstName/lastName/email/type/role).
// Phase-1 SoT users live in the hooks above (PhaseOneUser → /api/v1/users).
// These remain because OTC mint/redeem and `CustomerTypeahead` still consume
// the mock customer directory; migrating those is outside USDX-37 scope.

interface LegacyListParams {
  page?: number
  pageSize?: number
  search?: string
  type?: string
  role?: string
  sortBy?: string
  sortOrder?: string
}

function buildLegacyQuery(params: LegacyListParams): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

export function useCustomers(params: LegacyListParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async (): Promise<PaginatedResponse<Customer>> => {
      const res = await fetch(`/api/customers?${buildLegacyQuery(params)}`)
      if (!res.ok) throw new Error('Failed to fetch customers')
      return res.json()
    },
  })
}

export function useCustomerSummary() {
  return useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: async (): Promise<CustomerSummary> => {
      const res = await fetch('/api/customers/summary')
      if (!res.ok) throw new Error('Failed to fetch customer summary')
      return res.json()
    },
  })
}

export function useLegacyAddWallet(customerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { chain: Network; address: string }) => {
      if (!customerId) throw new Error('Missing user id')
      const res = await fetch(`/api/customers/${customerId}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(err?.error?.message ?? 'Failed to add wallet')
      }
      return res.json() as Promise<UserWallet>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useLegacyRemoveWallet(customerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (walletId: string) => {
      if (!customerId) throw new Error('Missing user id')
      const res = await fetch(
        `/api/customers/${customerId}/wallets/${walletId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to remove wallet')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
