import { useQuery } from '@tanstack/react-query'
import type { PaginatedResponse, ReportInsights, ReportRow } from '@/lib/types'

export interface ReportFilters {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  customerId?: string
  search?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: string
}

function buildQuery(params: ReportFilters): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

export function useReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['report', filters],
    queryFn: async () => {
      const res = await fetch(`/api/report?${buildQuery(filters)}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      return res.json() as Promise<PaginatedResponse<ReportRow>>
    },
  })
}

export function useReportInsights(filters: Omit<ReportFilters, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>) {
  return useQuery({
    queryKey: ['report', 'insights', filters],
    queryFn: async () => {
      const res = await fetch(`/api/report/insights?${buildQuery(filters)}`)
      if (!res.ok) throw new Error('Failed to fetch report insights')
      return res.json() as Promise<ReportInsights>
    },
  })
}

export async function fetchAllReportRows(filters: Omit<ReportFilters, 'page' | 'pageSize'>): Promise<ReportRow[]> {
  const res = await fetch(`/api/report?${buildQuery({ ...filters, page: 1, pageSize: 1000 })}`)
  if (!res.ok) throw new Error('Failed to fetch report rows for export')
  const data = (await res.json()) as PaginatedResponse<ReportRow>
  return data.data
}
