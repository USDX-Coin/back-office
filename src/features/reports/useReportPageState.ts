import { useState } from 'react'
import { toastErrorMessage } from '@/lib/errorToast'
import type { ReportFilter, ReportKind } from '@/lib/types'
import type { ReportFilterDraft } from './ReportFiltersToolbar'
import { defaultReportDateRange } from './dateRange'
import { useExportReportCsv } from './hooks'

export interface ReportPageState {
  draft: ReportFilterDraft
  setDraft: (next: ReportFilterDraft) => void
  appliedFilter: ReportFilter | null
  handleProcess: () => void
  handleExport: () => void
  isExporting: boolean
}

function initialDraft(): ReportFilterDraft {
  const { startDate, endDate } = defaultReportDateRange()
  return { startDate, endDate, chain: '', status: '', user: null }
}

function toFilter(draft: ReportFilterDraft): ReportFilter {
  return {
    startDate: draft.startDate,
    endDate: draft.endDate,
    chain: draft.chain || undefined,
    status: draft.status || undefined,
    userId: draft.user?.id,
  }
}

// Wires up the shared report page state — draft form, applied filter (locked
// in on Process), and CSV export. Pages own this state so the result query
// can react to applied-filter changes inside the same component tree.
export function useReportPageState(kind: ReportKind): ReportPageState {
  const [draft, setDraft] = useState<ReportFilterDraft>(initialDraft)
  const [appliedFilter, setAppliedFilter] = useState<ReportFilter | null>(null)
  const exportCsv = useExportReportCsv(kind)

  function handleProcess() {
    setAppliedFilter(toFilter(draft))
  }

  async function handleExport() {
    const filter = appliedFilter ?? toFilter(draft)
    try {
      await exportCsv.mutateAsync(filter)
    } catch (err) {
      // Kalimat dari peta galat terpusat; kode server ikut sebagai "Detail teknis".
      toastErrorMessage('CSV gagal diunduh. Coba lagi sebentar lagi.', err)
    }
  }

  return {
    draft,
    setDraft,
    appliedFilter,
    handleProcess,
    handleExport,
    isExporting: exportCsv.isPending,
  }
}
