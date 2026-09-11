import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  validateDateRange,
  type DateRangeProblem,
  type DateRangeRules,
  type DateRangeValue,
} from '@/lib/dateRange'

// Two `type="date"` inputs + the range rules both the reporting toolbar and the
// BNI statement panel need. Extracted from `ReportFiltersToolbar` (USDX-631) so
// the statement panel does not copy the inputs and the reports keep exactly the
// markup they had — the toolbar still composes Chain / Status / UserPicker
// around this component.

function problemMessage(problem: DateRangeProblem, rules: DateRangeRules): string {
  switch (problem) {
    case 'FORMAT':
      return 'Isi kedua tanggal.'
    case 'ORDER':
      return 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.'
    case 'MAX_DATE':
      return 'Tanggal akhir tidak boleh melewati hari ini (WIB).'
    case 'MAX_DAYS':
      return `Rentang paling banyak ${rules.maxDays} hari (inklusif).`
  }
}

interface Props extends DateRangeRules {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  /** Prefix for the two input ids (`<prefix>-start-date`, `<prefix>-end-date`). */
  idPrefix: string
  labels?: { start: string; end: string }
  disabled?: boolean
  /**
   * Render the rule violation under the end-date input. The reports toolbar
   * keeps its original silent behaviour (button simply disabled) by passing
   * `false`; the statement panel shows the 31-day message.
   */
  showMessage?: boolean
}

const LABEL_CLASS =
  'text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground'

export default function DateRangeFields({
  value,
  onChange,
  idPrefix,
  labels = { start: 'Start date', end: 'End date' },
  disabled = false,
  showMessage = true,
  maxDays,
  maxDate,
}: Props) {
  const rules: DateRangeRules = { maxDays, maxDate }
  const verdict = validateDateRange(value, rules)
  const startId = `${idPrefix}-start-date`
  const endId = `${idPrefix}-end-date`
  const messageId = `${idPrefix}-date-range-message`
  const showProblem = showMessage && verdict.problem !== null && verdict.problem !== 'FORMAT'

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={startId} className={LABEL_CLASS}>
          {labels.start}
        </Label>
        <Input
          id={startId}
          type="date"
          value={value.startDate}
          max={maxDate}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          className="h-9"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={endId} className={LABEL_CLASS}>
          {labels.end}
        </Label>
        <Input
          id={endId}
          type="date"
          value={value.endDate}
          max={maxDate}
          disabled={disabled}
          aria-invalid={showProblem || undefined}
          aria-describedby={showProblem ? messageId : undefined}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          className="h-9"
          required
        />
        {showProblem && (
          <p id={messageId} role="alert" className="text-[11.5px] text-destructive">
            {problemMessage(verdict.problem!, rules)}
          </p>
        )}
      </div>
    </>
  )
}
