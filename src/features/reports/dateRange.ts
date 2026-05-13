// Reporting date inputs are anchored to Asia/Jakarta per sot/phase-1.md
// § Reporting. Computing "today" in browser-local time would silently shift
// the default window when an operator works from another timezone — pin the
// reference timezone explicitly.

const JAKARTA_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function jakartaDateString(date: Date): string {
  return JAKARTA_DATE_FMT.format(date)
}

export function todayInJakarta(): string {
  return jakartaDateString(new Date())
}

// Subtract `days` calendar days from a YYYY-MM-DD string. Parsed as UTC midnight
// so DST shifts in the browser locale cannot push the result off by a day.
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const ms = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000
  const out = new Date(ms)
  const yy = out.getUTCFullYear()
  const mm = String(out.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(out.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Default range per Linear AC: 7 days back to today (inclusive), Asia/Jakarta.
export function defaultReportDateRange(): { startDate: string; endDate: string } {
  const endDate = todayInJakarta()
  return { startDate: shiftIsoDate(endDate, -7), endDate }
}
