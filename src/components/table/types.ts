// USDX-27: shared types for the new generic data-table toolbar (Search /
// Sort / Filter / Columns). Each list page declares filter + sort + column
// metadata; the toolbar renders the inputs.

export interface FilterOption {
  value: string
  label: string
  /** Render the option unselectable (e.g. a feature deferred to a later phase). */
  disabled?: boolean
  /** Short suffix rendered next to a disabled option's label (e.g. "Week 2+"). */
  disabledHint?: string
}

/** Single-select filter writing one URL param. */
export interface SelectFilterDef {
  kind: 'select'
  /** URL search-param key. */
  key: string
  /** Human label rendered in the filter modal AND in the active-filter chip. */
  label: string
  options: FilterOption[]
}

/** Date-range filter writing two URL params (`startKey`, `endKey`). */
export interface DateRangeFilterDef {
  kind: 'dateRange'
  startKey: string
  endKey: string
  label: string
}

/**
 * Free-form text filter writing one URL param.
 *
 * Added for `/durianpay-api-calls` (Log Panggilan DurianPay), whose contract
 * takes four text filters — path PREFIX, referenceNo, responseCode, httpStatus —
 * and no body search at all. They belong in the same popover as every other
 * filter rather than in the DataTable's default `Search` box, which writes
 * `?search=` and means "find this anywhere".
 *
 * `hint` exists because a text box invites the wrong expectation: a filter that
 * matches an EXACT value, or only a PREFIX, has to say so on the spot — a box
 * that silently returns nothing reads as "there is no such data".
 */
export interface TextFilterDef {
  kind: 'text'
  /** URL search-param key. */
  key: string
  /** Human label rendered in the filter modal AND in the active-filter chip. */
  label: string
  placeholder?: string
  /** One line under the input saying how the value is matched. */
  hint?: string
  /** Contract ceiling — the browser refuses longer input so the server never 400s. */
  maxLength?: number
  inputMode?: 'text' | 'numeric'
}

export type FilterDef = SelectFilterDef | DateRangeFilterDef | TextFilterDef

/** Single sort column descriptor for the Sort popover. */
export interface SortColumnDef {
  /** Matches the URL `sortBy` value (and the table column id). */
  id: string
  label: string
}

/** A column the user can show/hide via the Columns popover. */
export interface ColumnConfig {
  /** Matches the column.id (or accessorKey). */
  key: string
  label: string
  /** Hidden by default? Default: false. */
  hiddenByDefault?: boolean
  /** Lock-in: cannot be hidden by the user (e.g. a primary-name column). */
  required?: boolean
}
