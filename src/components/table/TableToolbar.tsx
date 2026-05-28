import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { VisibilityState } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import SortPopover from './SortPopover'
import FilterPopover from './FilterPopover'
import ColumnsPopover from './ColumnsPopover'
import type { ColumnConfig, FilterDef, SortColumnDef } from './types'

interface SearchProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** Apply search after this many ms of no typing. Default 300. */
  debounceMs?: number
}

interface SortProps {
  columns: SortColumnDef[]
  sortBy: string
  sortOrder: 'asc' | 'desc' | ''
  onChange: (sortBy: string, sortOrder: 'asc' | 'desc' | '') => void
}

interface FilterProps {
  defs: FilterDef[]
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

interface ColumnsProps {
  items: ColumnConfig[]
  visibility: VisibilityState
  onChange: (next: VisibilityState) => void
}

interface TableToolbarProps {
  search: SearchProps
  sort?: SortProps
  filter?: FilterProps
  columns?: ColumnsProps
  className?: string
}

// USDX-27: standard toolbar for every list page — search input + Sort /
// Filter / Columns popover buttons + a chip row showing the active filters.
// Replaces the per-page MintBurnFilterToolbar / UserFilterToolbar /
// StaffFilterToolbar that each duplicated the same pattern with different
// fields.
export default function TableToolbar({
  search,
  sort,
  filter,
  columns,
  className,
}: TableToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* USDX-27: stack search + buttons on mobile (search takes full width
          so the placeholder doesn't get truncated); inline at ≥sm. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DebouncedSearch {...search} />
        <div className="flex flex-wrap items-center gap-2">
          {sort && (
            <SortPopover
              columns={sort.columns}
              sortBy={sort.sortBy}
              sortOrder={sort.sortOrder}
              onChange={sort.onChange}
            />
          )}
          {filter && (
            <FilterPopover
              defs={filter.defs}
              values={filter.values}
              activeCount={countActiveFilters(filter.defs, filter.values)}
              onApply={filter.onChange}
              onClearAll={() => filter.onChange(emptyFilterValues(filter.defs))}
            />
          )}
          {columns && (
            <ColumnsPopover
              columns={columns.items}
              visibility={columns.visibility}
              onChange={columns.onChange}
            />
          )}
        </div>
      </div>

      {filter && <ActiveFilterChips defs={filter.defs} values={filter.values} onChange={filter.onChange} />}
    </div>
  )
}

function DebouncedSearch({ value, onChange, placeholder, debounceMs = 300 }: SearchProps) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmitted = useRef(value)

  // Sync when the URL value changes externally (e.g. chip remove or clear).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setDraft(value)
      lastEmitted.current = value
    }
  }, [value])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(next: string) {
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastEmitted.current = next
      onChange(next)
    }, debounceMs)
  }

  return (
    <div className="relative w-full sm:max-w-sm sm:flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="h-9 bg-card pl-8"
        aria-label="Search"
      />
    </div>
  )
}

function ActiveFilterChips({
  defs,
  values,
  onChange,
}: {
  defs: FilterDef[]
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = []

  for (const def of defs) {
    if (def.kind === 'select') {
      const v = values[def.key]
      if (!v) continue
      const opt = def.options.find((o) => o.value === v)
      chips.push({
        key: def.key,
        label: `${def.label}: ${opt?.label ?? v}`,
        onRemove: () => onChange({ ...values, [def.key]: '' }),
      })
    } else {
      const start = values[def.startKey]
      const end = values[def.endKey]
      if (!start && !end) continue
      const range = [start, end].filter(Boolean).join(' – ') || '—'
      chips.push({
        key: `${def.startKey}-${def.endKey}`,
        label: `${def.label}: ${range}`,
        onRemove: () => onChange({ ...values, [def.startKey]: '', [def.endKey]: '' }),
      })
    }
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-foreground"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

function countActiveFilters(defs: FilterDef[], values: Record<string, string>): number {
  let n = 0
  for (const def of defs) {
    if (def.kind === 'select') {
      if (values[def.key]) n++
    } else if (values[def.startKey] || values[def.endKey]) {
      n++
    }
  }
  return n
}

function emptyFilterValues(defs: FilterDef[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const def of defs) {
    if (def.kind === 'select') out[def.key] = ''
    else {
      out[def.startKey] = ''
      out[def.endKey] = ''
    }
  }
  return out
}
