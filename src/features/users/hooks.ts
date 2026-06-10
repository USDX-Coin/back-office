// USDX-37 — Wires the Users page to the real BE.
// Endpoints: sot/openapi.yaml § /api/v1/users + /api/v1/users/:id/wallets

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type {
  ActivationStatus,
  EntityType,
  KycStatus,
  PhaseOneCreateUser,
  PhaseOneCreateUserWallet,
  PhaseOnePaginatedResponse,
  PhaseOneUpdateUser,
  PhaseOneUser,
  PhaseOneUserDetail,
  PhaseOneUserWallet,
  ResendActivationResult,
} from '@/lib/types'

// USDX-47 S3: filter by kycStatus and entityType. sot/api/users.yaml § GET
// /users — both single-value enums. USDX-156 adds activationStatus
// (PENDING/ACTIVATED/FAILED, absent = no filter — "All" sends no param).
export interface UsersListParams {
  page?: number
  limit?: number
  search?: string
  kycStatus?: KycStatus
  entityType?: EntityType
  activationStatus?: ActivationStatus
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

// USDX-156 (Phase 2): POST no longer returns a password — BE auto-sends the
// activation email instead (admin-created.html, link valid 7 days). The old
// USDX-47 PasswordRevealDialog flow was removed with backend PR #87.
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PhaseOneCreateUser) =>
      apiFetch<PhaseOneUser>('/api/v1/users', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

// USDX-156 — POST /api/v1/users/:id/resend-activation (Admin only).
// Rotates the activation token and re-queues admin-created.html. Only valid
// while email_verified_at is null: 409 ALREADY_VERIFIED otherwise, 429
// TOO_MANY_REQUESTS within the 60s per-user cooldown (sot/api/users.yaml
// § resendActivation).
export function useResendActivation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ResendActivationResult>(`/api/v1/users/${id}/resend-activation`, {
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['users', 'detail', id] })
    },
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

