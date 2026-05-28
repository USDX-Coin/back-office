import { Columns3 } from 'lucide-react'
import type { VisibilityState } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ColumnConfig } from './types'

interface ColumnsPopoverProps {
  columns: ColumnConfig[]
  visibility: VisibilityState
  onChange: (next: VisibilityState) => void
}

// USDX-27: per-table column visibility toggle. Persists via the parent's
// useColumnVisibility hook (localStorage). Required columns can't be hidden.
export default function ColumnsPopover({ columns, visibility, onChange }: ColumnsPopoverProps) {
  function toggle(key: string, next: boolean) {
    onChange({ ...visibility, [key]: next })
  }

  function reset() {
    const all: VisibilityState = {}
    for (const c of columns) all[c.key] = !c.hiddenByDefault
    onChange(all)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-[12.5px]">
          <Columns3 className="h-3.5 w-3.5" />
          <span>Columns</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Columns</p>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
          <ul className="space-y-2">
            {columns.map((c) => {
              const checked = visibility[c.key] !== false
              return (
                <li key={c.key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`col-${c.key}`}
                    checked={checked}
                    disabled={c.required}
                    onCheckedChange={(v) => toggle(c.key, v === true)}
                  />
                  <label
                    htmlFor={`col-${c.key}`}
                    className="flex-1 cursor-pointer text-[13px]"
                  >
                    {c.label}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}
