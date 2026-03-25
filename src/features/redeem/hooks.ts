import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import type { RedeemRequest, PaginatedResponse } from '@/lib/types'

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

async function fetchRedeemList(queryString: string): Promise<PaginatedResponse<RedeemRequest>> {
  const res = await fetch(`/api/redeem?${queryString}`)
  if (!res.ok) throw new Error('Failed to fetch redeem list')
  return res.json()
}

export function useRedeemList(pageSize = 10) {
  const [searchParams] = useSearchParams()
  const queryString = buildQueryString(searchParams, pageSize)

  return useQuery({
    queryKey: ['redeem', queryString],
    queryFn: () => fetchRedeemList(queryString),
  })
}
