import type { StatusOption } from './ReportFiltersToolbar'

// MintStatus enum from sot/api/mint.yaml.
export const MINT_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

// BurnStatus enum from sot/api/burn.yaml.
export const BURN_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'IDR_TRANSFERRED', label: 'IDR transferred' },
  { value: 'REJECTED', label: 'Rejected' },
] as const
