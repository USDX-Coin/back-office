import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch, apiFetchBlob } from '@/lib/apiFetch'
import { saveBlobAs } from '@/lib/csv'
import type {
  ByUserRow,
  DailyBurnRow,
  DailyMintRow,
  ReportFilter,
  ReportKind,
} from '@/lib/types'

const ENDPOINT: Record<ReportKind, string> = {
  'mint-daily': '/api/v1/reports/mint/daily',
  'mint-by-user': '/api/v1/reports/mint/by-user',
  'burn-daily': '/api/v1/reports/burn/daily',
  'burn-by-user': '/api/v1/reports/burn/by-user',
}

const FILENAME_PREFIX: Record<ReportKind, string> = {
  'mint-daily': 'mint-daily',
  'mint-by-user': 'mint-by-user',
  'burn-daily': 'burn-daily',
  'burn-by-user': 'burn-by-user',
}

// Build the `?startDate=…&endDate=…[&chain=…][&status=…][&userId=…]` query
// string. Empty / undefined values are dropped so the BE treats them as "all"
// per sot/api/reporting.yaml parameter defaults.
export function buildReportQuery(filter: ReportFilter, extra?: Record<string, string>): string {
  const sp = new URLSearchParams()
  sp.set('startDate', filter.startDate)
  sp.set('endDate', filter.endDate)
  if (filter.chain) sp.set('chain', filter.chain)
  if (filter.status) sp.set('status', filter.status)
  if (filter.userId) sp.set('userId', filter.userId)
  if (extra) for (const [k, v] of Object.entries(extra)) sp.set(k, v)
  return sp.toString()
}

function reportQueryKey(kind: ReportKind, filter: ReportFilter) {
  return ['reports', kind, filter] as const
}

// Generic JSON fetch — typed per call site. `enabled` is gated by the page so
// the query only fires after the operator clicks Process (USDX-81 AC).
function useReportQuery<T>(kind: ReportKind, filter: ReportFilter | null) {
  return useQuery({
    queryKey: filter ? reportQueryKey(kind, filter) : ['reports', kind, 'idle'],
    queryFn: () => apiFetch<T[]>(`${ENDPOINT[kind]}?${buildReportQuery(filter!)}`),
    enabled: filter !== null,
    staleTime: 30 * 1000,
  })
}

export function useDailyMintReport(filter: ReportFilter | null) {
  return useReportQuery<DailyMintRow>('mint-daily', filter)
}

export function useDailyBurnReport(filter: ReportFilter | null) {
  return useReportQuery<DailyBurnRow>('burn-daily', filter)
}

export function useMintByUserReport(filter: ReportFilter | null) {
  return useReportQuery<ByUserRow>('mint-by-user', filter)
}

export function useBurnByUserReport(filter: ReportFilter | null) {
  return useReportQuery<ByUserRow>('burn-by-user', filter)
}

// Trigger CSV download for the given report. The BE returns a `text/csv`
// response with `Content-Disposition: attachment; filename=<kind>_<start>_<end>.csv`
// (sot/api/reporting.yaml). We parse the filename from the header when present
// and fall back to a client-built name so the download still works against
// mocks or non-conforming dev servers.
export function useExportReportCsv(kind: ReportKind) {
  return useMutation({
    mutationFn: async (filter: ReportFilter) => {
      const { blob, filename } = await apiFetchBlob(
        `${ENDPOINT[kind]}?${buildReportQuery(filter, { format: 'csv' })}`
      )
      const fallback = `${FILENAME_PREFIX[kind]}_${filter.startDate}_${filter.endDate}.csv`
      saveBlobAs(blob, filename ?? fallback)
    },
  })
}
