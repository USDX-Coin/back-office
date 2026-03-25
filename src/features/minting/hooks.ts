import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import type { MintingRequest, PaginatedResponse } from '@/lib/types'
import { buildQueryString } from '@/lib/query'

async function fetchMintingList(queryString: string): Promise<PaginatedResponse<MintingRequest>> {
  const res = await fetch(`/api/minting?${queryString}`)
  if (!res.ok) throw new Error('Failed to fetch minting list')
  return res.json()
}

export function useMintingList(pageSize = 10) {
  const [searchParams] = useSearchParams()
  const queryString = buildQueryString(searchParams, pageSize)

  return useQuery({
    queryKey: ['minting', queryString],
    queryFn: () => fetchMintingList(queryString),
  })
}

export function useApproveMinting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/minting/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error?.message || 'Failed to approve')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minting'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRejectMinting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/minting/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error?.message || 'Failed to reject')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minting'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useStartReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/minting/${id}/review`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error?.message || 'Failed to start review')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minting'] })
    },
  })
}
