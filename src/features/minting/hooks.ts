import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import type { MintingRequest, PaginatedResponse } from '@/lib/types'

function buildQueryString(params: URLSearchParams, pageSize: number): string {
  const page = params.get('page') || '1'
  const search = params.get('search') || ''
  const status = params.get('status') || ''
  const sortBy = params.get('sortBy') || ''
  const sortOrder = params.get('sortOrder') || 'desc'
  const startDate = params.get('startDate') || ''
  const endDate = params.get('endDate') || ''

  const qs = new URLSearchParams()
  qs.set('page', page)
  qs.set('pageSize', String(pageSize))
  if (search) qs.set('search', search)
  if (status) qs.set('status', status)
  if (sortBy) qs.set('sortBy', sortBy)
  if (sortOrder) qs.set('sortOrder', sortOrder)
  if (startDate) qs.set('startDate', startDate)
  if (endDate) qs.set('endDate', endDate)
  return qs.toString()
}

async function fetchMintingList(queryString: string): Promise<PaginatedResponse<MintingRequest>> {
  const res = await fetch(`/api/minting?${queryString}`)
  if (!res.ok) throw new Error('Failed to fetch minting list')
  return res.json()
}

async function fetchMintingDetail(id: string): Promise<MintingRequest> {
  const res = await fetch(`/api/minting/${id}`)
  if (!res.ok) throw new Error('Failed to fetch minting detail')
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

export function useMintingDetail(id: string | null) {
  return useQuery({
    queryKey: ['minting', id],
    queryFn: () => fetchMintingDetail(id!),
    enabled: !!id,
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
