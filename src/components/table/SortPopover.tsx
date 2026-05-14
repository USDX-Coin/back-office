import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { SortColumnDef } from './types'

interface SortPopoverProps {
  columns: SortColumnDef[]
  sortBy: string
  sortOrder: 'asc' | 'desc' | ''
  onChange: (sortBy: string, sortOrder: 'asc' | 'desc' | '') => void
}

const NONE = '__none__'

// USDX-27: discoverable Sort affordance — the table headers are still
// click-to-sort, but operators don't always realise it. The popover lists the
// sortable columns + an asc/desc toggle and writes back to the same URL params
// the headers use (`sortBy`, `sortOrder`).
export default function SortPopover({ columns, sortBy, sortOrder, onChange }: SortPopoverProps) {
  const active = columns.find((c) => c.id === sortBy)
  const order = sortOrder || 'desc'

  function setField(next: string) {
    if (next === NONE) {
      onChange('', '')
      return
    }
    onChange(next, order)
  }

  function setOrder(next: 'asc' | 'desc') {
    if (!sortBy) return
    onChange(sortBy, next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-[12.5px]">
          {active ? (
            order === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" />
          )}
          <span>Sort</span>
          {active && (
            <span className="text-muted-foreground">
              <span className="mx-1">·</span>
              {active.label}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              Sort by
            </p>
            <Select value={sortBy || NONE} onValueChange={setField}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              Order
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant={order === 'asc' && active ? 'default' : 'outline'}
                size="sm"
                disabled={!sortBy}
                onClick={() => setOrder('asc')}
                className={cn('h-9 gap-1.5')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Ascending
              </Button>
              <Button
                type="button"
                variant={order === 'desc' && active ? 'default' : 'outline'}
                size="sm"
                disabled={!sortBy}
                onClick={() => setOrder('desc')}
                className={cn('h-9 gap-1.5')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Descending
              </Button>
            </div>
          </div>
          {active && (
            <button
              type="button"
              onClick={() => onChange('', '')}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Clear sort
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
