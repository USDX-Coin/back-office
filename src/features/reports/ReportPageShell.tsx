import { type ReactNode } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import ReportFiltersToolbar, { type StatusOption } from './ReportFiltersToolbar'
import type { ReportPageState } from './useReportPageState'

interface Props {
  state: ReportPageState
  eyebrow: string
  title: string
  italicAccent?: string
  subtitle?: ReactNode
  statusOptions: readonly StatusOption[]
  showUserPicker: boolean
  isFetching: boolean
  children: ReactNode
}

export default function ReportPageShell({
  state,
  eyebrow,
  title,
  italicAccent,
  subtitle,
  statusOptions,
  showUserPicker,
  isFetching,
  children,
}: Props) {
  const exportDisabled = isFetching || state.isExporting || state.appliedFilter === null

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        italicAccent={italicAccent}
        subtitle={subtitle}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={state.handleExport}
            disabled={exportDisabled}
            data-testid="report-export-csv"
          >
            {state.isExporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Export CSV
          </Button>
        }
      />

      <ReportFiltersToolbar
        values={state.draft}
        onChange={state.setDraft}
        statusOptions={statusOptions}
        showUserPicker={showUserPicker}
        onProcess={state.handleProcess}
        isProcessing={isFetching}
      />

      <div className="rounded-md border border-border bg-card">
        {state.appliedFilter === null ? (
          <TableEmptyState
            mode="no-data"
            title="Run a report to view data"
            description="Pick a date range and click Process to populate the table."
          />
        ) : (
          children
        )}
      </div>
    </div>
  )
}
