import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import type { RedeemRequest, PaginatedResponse } from '@/lib/types'
import { buildQueryString } from '@/lib/query'

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
