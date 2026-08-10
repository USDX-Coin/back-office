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

export type FilterDef = SelectFilterDef | DateRangeFilterDef

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
