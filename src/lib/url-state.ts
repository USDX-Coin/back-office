import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  type ParserBuilder,
} from 'nuqs'

// Canonical URL keys for table state. These names are part of the contract
// with MSW handlers (src/mocks/handlers.ts) and existing page-level tests
// that assert URL search params, so they must not change.
//
// Add a new key here only if a corresponding MSW handler reads it.

export const tableSearchParsers = {
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger
    .withDefault(10)
    .withOptions({ clearOnDefault: true }),
  search: parseAsString.withDefault(''),
  sortBy: parseAsString.withDefault(''),
  sortOrder: parseAsStringEnum(['asc', 'desc'] as const).withDefault('desc'),
} as const

// Common one-off parsers reused across pages. Each page composes the subset
// it needs via useQueryStates so unrelated fields don't trigger renders.
export const stringParser = parseAsString.withDefault('')

export const dateRangeParsers = {
  startDate: parseAsString.withDefault(''),
  endDate: parseAsString.withDefault(''),
} as const

// Filter parsers used by Users / Staff / Report. Add narrow enum parsers when a
// page wants type-checked values instead of free string filters.
export const directoryFilterParsers = {
  type: parseAsString.withDefault(''),
  role: parseAsString.withDefault(''),
  status: parseAsString.withDefault(''),
  customerId: parseAsString.withDefault(''),
} as const

export type TableSearchKey = keyof typeof tableSearchParsers

// Re-export the parser type so callers can compose extended parser maps.
export type { ParserBuilder }
