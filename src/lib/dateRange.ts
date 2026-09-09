// Pure date-range rules shared by `components/DateRangeFields` and whoever
// gates a submit button on them (reports toolbar, BNI statement panel —
// USDX-631). Kept out of the component file so React Fast Refresh sees a
// component-only module there.

export interface DateRangeValue {
  startDate: string
  endDate: string
}

export type DateRangeProblem = 'FORMAT' | 'ORDER' | 'MAX_DAYS' | 'MAX_DATE'

export interface DateRangeRules {
  /** Inclusive maximum span in calendar days (31 = 1 Aug..31 Aug OK, 1 Aug..1 Sep not). */
  maxDays?: number
  /** Latest `endDate` allowed, `YYYY-MM-DD` (e.g. today in WIB). */
  maxDate?: string
}

export interface DateRangeVerdict {
  valid: boolean
  problem: DateRangeProblem | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Calendar-day arithmetic on UTC midnights: `new Date(y, m, d)` in the browser
// zone would drift across DST and could turn a 31-day window into 30 or 32.
function utcDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Inclusive number of calendar days between two `YYYY-MM-DD` strings. */
export function inclusiveDaySpan(startDate: string, endDate: string): number {
  return utcDayNumber(endDate) - utcDayNumber(startDate) + 1
}

/**
 * Pure verdict on a range: format, order, then the optional caps. Both callers
 * use it to disable their submit button; the component uses it for the message.
 */
export function validateDateRange(
  value: DateRangeValue,
  rules: DateRangeRules = {}
): DateRangeVerdict {
  if (!ISO_DATE.test(value.startDate) || !ISO_DATE.test(value.endDate)) {
    return { valid: false, problem: 'FORMAT' }
  }
  if (value.startDate > value.endDate) return { valid: false, problem: 'ORDER' }
  if (rules.maxDate !== undefined && value.endDate > rules.maxDate) {
    return { valid: false, problem: 'MAX_DATE' }
  }
  if (
    rules.maxDays !== undefined &&
    inclusiveDaySpan(value.startDate, value.endDate) > rules.maxDays
  ) {
    return { valid: false, problem: 'MAX_DAYS' }
  }
  return { valid: true, problem: null }
}
