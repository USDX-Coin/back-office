import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { FilterDef } from './types'

interface FilterPopoverProps {
  defs: FilterDef[]
  values: Record<string, string>
  onApply: (next: Record<string, string>) => void
  onClearAll: () => void
  /** Count of active filters — drives the badge on the trigger button. */
  activeCount: number
}

const ALL = '__all__'

// USDX-27: a single popover that renders inputs for every filter declared by
// the page (FilterDef[]). Local draft state — commits to URL only on Apply, so
// rapid changes don't trigger N requests.
export default function FilterPopover({ defs, values, onApply, onClearAll, activeCount }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(values)

  // Re-sync the draft when the popover opens (or when external values change
  // while closed, e.g. via "Clear all" or chip remove).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setDraft(values)
  }, [open, values])
  /* eslint-enable react-hooks/set-state-in-effect */

  function setKey(key: string, value: string) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function apply() {
    onApply(draft)
    setOpen(false)
  }

  function clearDraft() {
    const cleared: Record<string, string> = {}
    for (const def of defs) {
      if (def.kind === 'select') cleared[def.key] = ''
      else {
        cleared[def.startKey] = ''
        cleared[def.endKey] = ''
      }
    }
    setDraft(cleared)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-[12.5px]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span
              className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-primary-foreground"
              aria-label={`${activeCount} active filter${activeCount === 1 ? '' : 's'}`}
            >
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Filters</p>
            <button
              type="button"
              onClick={() => {
                clearDraft()
                onClearAll()
              }}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-3">
            {defs.map((def) => {
              if (def.kind === 'select') {
                const v = draft[def.key] ?? ''
                return (
                  <div key={def.key}>
                    <Label className="text-[12px] font-medium">{def.label}</Label>
                    <Select
                      value={v || ALL}
                      onValueChange={(next) => setKey(def.key, next === ALL ? '' : next)}
                    >
                      <SelectTrigger
                        aria-label={def.label}
                        className="mt-1 h-9 text-[12.5px]"
                      >
                        <SelectValue placeholder={`All ${def.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All {def.label.toLowerCase()}</SelectItem>
                        {def.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                            {opt.disabled && opt.disabledHint && (
                              <span className="ml-1.5 text-[10.5px] text-muted-foreground">
                                {opt.disabledHint}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              // dateRange
              const start = draft[def.startKey] ?? ''
              const end = draft[def.endKey] ?? ''
              return (
                <div key={`${def.startKey}-${def.endKey}`}>
                  <Label className="text-[12px] font-medium">{def.label}</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={start}
                      onChange={(e) => setKey(def.startKey, e.target.value)}
                      aria-label={`${def.label} start`}
                      className="h-9 text-[12.5px]"
                    />
                    <Input
                      type="date"
                      value={end}
                      onChange={(e) => setKey(def.endKey, e.target.value)}
                      aria-label={`${def.label} end`}
                      className="h-9 text-[12.5px]"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
