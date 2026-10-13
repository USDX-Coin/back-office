import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { PaymentMethod, ReorderPaymentMethodsBody, UpdatePaymentMethodBody } from '@/lib/types'

// `sot/api/payment-methods.yaml`. GET Admin + Developer; PATCH dan PUT urutan
// Admin saja (server menegakkan 403 lagi). Backendnya USDX-749; MSW hanya
// melayani dev/test — build yang di-deploy memanggil server sungguhan, jadi
// merge setelah backend (`pnpm cek:backend`, `scripts/backend-requirements.json`).

export const PAYMENT_METHODS_KEY = ['payment-methods'] as const

export function usePaymentMethods() {
  return useQuery({
    queryKey: PAYMENT_METHODS_KEY,
    queryFn: () => apiFetch<PaymentMethod[]>('/api/v1/payment-methods'),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY })
  // Jejak perubahan dibaca dari activity_log (resourceType PAYMENT_METHOD).
  qc.invalidateQueries({ queryKey: ['activity-logs'] })
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePaymentMethodBody }) =>
      apiFetch<PaymentMethod>(`/api/v1/payment-methods/${id}`, { method: 'PATCH', body }),
    onSettled: () => invalidate(qc),
  })
}

export function useReorderPaymentMethods() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReorderPaymentMethodsBody) =>
      apiFetch<PaymentMethod[]>('/api/v1/payment-method-order', { method: 'PUT', body }),
    onSettled: () => invalidate(qc),
  })
}
