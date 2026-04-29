import { useEffect, useState } from 'react'
import { format, subDays, subHours } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DateRange {
  from?: string // ISO yyyy-MM-dd
  to?: string
}

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange) => void
  placeholder?: string
  className?: string
  /** Disabled style + interaction lock */
  disabled?: boolean
}

interface Preset {
  label: string
  hint: string
  build: () => DateRange
}

const PRESETS: Preset[] = [
  {
    label: 'Last hour',
    hint: 'H',
    build: () => {
      const now = new Date()
      return {
        from: format(subHours(now, 1), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
      }
    },
  },
  {
    label: 'Last 7 days',
    hint: 'W',
    build: () => {
      const now = new Date()
      return {
        from: format(subDays(now, 7), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
      }
    },
  },
  {
    label: 'Last 14 days',
    hint: 'B',
    build: () => {
      const now = new Date()
      return {
        from: format(subDays(now, 14), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
      }
    },
  },
  {
    label: 'Last 30 days',
    hint: 'M',
    build: () => {
      const now = new Date()
      return {
        from: format(subDays(now, 30), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
      }
    },
  },
]

function fromISO(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range || (!range.from && !range.to)) return ''
  const start = range.from ? format(new Date(range.from), 'MMM d') : '…'
  const end = range.to ? format(new Date(range.to), 'MMM d') : '…'
  return `${start} — ${end}`
}

export default function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [startInput, setStartInput] = useState(value?.from ?? '')
  const [endInput, setEndInput] = useState(value?.to ?? '')

  // Keep local input drafts in sync when value updates from outside.
  useEffect(() => {
    setStartInput(value?.from ?? '')
    setEndInput(value?.to ?? '')
  }, [value?.from, value?.to])

  function emit(range: DateRange) {
    onChange?.(range)
  }

  function applyPreset(preset: Preset) {
    const next = preset.build()
    setStartInput(next.from ?? '')
    setEndInput(next.to ?? '')
    emit(next)
    setOpen(false)
  }

  function applyCalendar(range: { from?: Date; to?: Date } | undefined) {
    const next: DateRange = {
      from: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
    }
    setStartInput(next.from ?? '')
    setEndInput(next.to ?? '')
    emit(next)
  }

  function commitCustomRange() {
    const next: DateRange = {
      from: startInput || undefined,
      to: endInput || undefined,
    }
    if (next.from && next.to && new Date(next.from) > new Date(next.to)) {
      // Keep popover open; ignore invalid range commit
      return
    }
    emit(next)
  }

  const label = formatRangeLabel(value) || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'h-9 gap-2 font-normal',
            !value?.from && !value?.to && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex w-44 flex-col border-r border-border p-2">
            <div className="px-1.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              Quick range
            </div>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="flex items-center justify-between rounded-md px-1.5 py-1.5 text-left text-[12.5px] hover:bg-accent"
              >
                <span>{preset.label}</span>
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9.5px] leading-none">
                  {preset.hint}
                </kbd>
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={{
                from: fromISO(value?.from),
                to: fromISO(value?.to),
              }}
              onSelect={applyCalendar}
              numberOfMonths={1}
              defaultMonth={fromISO(value?.from) ?? new Date()}
            />
            <Separator />
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  Start
                </label>
                <Input
                  type="date"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={commitCustomRange}
                  className="h-8 text-[12px]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  End
                </label>
                <Input
                  type="date"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={commitCustomRange}
                  className="h-8 text-[12px]"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
