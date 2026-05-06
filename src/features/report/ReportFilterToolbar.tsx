import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import CustomerTypeahead from '@/components/CustomerTypeahead'
import type { Customer } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface ReportFilterValues {
  startDate: string
  endDate: string
  type: string
  status: string
  customer: Customer | null
  search: string
}

interface ReportFilterToolbarProps {
  values: ReportFilterValues
  onChange: (next: ReportFilterValues) => void
  onClear: () => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const

export default function ReportFilterToolbar({
  values,
  onChange,
  onClear,
}: ReportFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  const hasFilters = Boolean(
    values.startDate ||
      values.endDate ||
      values.type ||
      values.status ||
      values.customer ||
      values.search
  )

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    onChange({ ...values, search: searchInput })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={values.startDate}
            onChange={(e) => onChange({ ...values, startDate: e.target.value })}
            className="w-[150px] bg-card"
            aria-label="Start date"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={values.endDate}
            onChange={(e) => onChange({ ...values, endDate: e.target.value })}
            className="w-[150px] bg-card"
            aria-label="End date"
          />
        </div>

        <Select
          value={values.type || 'all'}
          onValueChange={(val) => onChange({ ...values, type: val === 'all' ? '' : val })}
        >
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="mint">Mint</SelectItem>
            <SelectItem value="redeem">Redeem</SelectItem>
          </SelectContent>
        </Select>

        <div className="min-w-[220px] flex-1">
          <CustomerTypeahead
            value={values.customer}
            onSelect={(c) => onChange({ ...values, customer: c })}
            placeholder="Filter by customer…"
          />
        </div>

        <form onSubmit={submitSearch} className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tx id or name…"
            className="pl-9 bg-card"
            aria-label="Search transactions"
          />
        </form>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div
        className="inline-flex rounded-lg bg-muted/60 p-0.5"
        role="group"
        aria-label="Status filter"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = (values.status || '') === opt.value
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => onChange({ ...values, status: opt.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
