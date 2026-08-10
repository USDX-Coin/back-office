// USDX-485 (audit alur uang P1-18) — kontak on-call insiden uang.
// Endpoint admin-only di backend (`api/v1/oncall-contacts`); BE membalas 403
// untuk role lain, gerbang FE hanya mencegah operator sampai ke form dan
// melihat nomor telepon yang tak boleh dilihatnya.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type {
  CreateOncallContact,
  OncallContact,
  UpdateOncallContact,
} from '@/lib/types'

const ONCALL_QUERY_KEY = ['oncall-contacts'] as const

// GET mengembalikan array polos (tanpa paginasi) — direktori on-call adalah
// puluhan baris, dan backend memang tidak mem-paginasinya.
export function useOncallContacts(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ONCALL_QUERY_KEY,
    queryFn: () => apiFetch<OncallContact[]>('/api/v1/oncall-contacts'),
    enabled: options.enabled ?? true,
  })
}

export function useCreateOncallContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOncallContact) =>
      apiFetch<OncallContact>('/api/v1/oncall-contacts', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ONCALL_QUERY_KEY }),
  })
}

export function useUpdateOncallContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateOncallContact }) =>
      apiFetch<OncallContact>(`/api/v1/oncall-contacts/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ONCALL_QUERY_KEY }),
  })
}

// Hard delete — backend tidak menyimpan kolom soft-delete; jejak perubahannya
// hidup di `activity_log` (aksi ONCALL_CONTACT_DELETED, memuat nilai sebelum).
export function useDeleteOncallContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/v1/oncall-contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ONCALL_QUERY_KEY }),
  })
}
