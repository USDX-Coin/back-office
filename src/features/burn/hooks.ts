import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { BurnRequestDetail, CreateBurnRequest } from '@/lib/types'

const BURN_ENDPOINT = '/api/v1/burn'

export function useCreateBurn() {
  const qc = useQueryClient()
  return useMutation<BurnRequestDetail, Error, CreateBurnRequest>({
    mutationFn: (input) =>
      apiFetch<BurnRequestDetail>(BURN_ENDPOINT, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}
