// USDX-27: filter / column config for the users list (TableToolbar).
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const USERS_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'kycStatus',
    label: 'KYC',
    options: [
      { value: 'UNVERIFIED', label: 'Unverified' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'VERIFIED', label: 'Verified' },
      { value: 'REJECTED', label: 'Rejected' },
    ],
  },
  {
    kind: 'select',
    key: 'entityType',
    label: 'Entity',
    options: [
      { value: 'INDIVIDUAL', label: 'Individual' },
      { value: 'LEGAL_ENTITY', label: 'Legal Entity' },
    ],
  },
  // USDX-156 — sot/api/users.yaml § activationStatus. "All" = no param sent.
  {
    kind: 'select',
    key: 'activationStatus',
    label: 'Activation',
    options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'ACTIVATED', label: 'Activated' },
      { value: 'FAILED', label: 'Failed email' },
    ],
  },
]

// Column ids must match the TanStack ColumnDef ids in UsersPage.
export const USERS_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'entityType', label: 'Entity' },
  { key: 'kycStatus', label: 'KYC' },
  { key: 'activation', label: 'Activation' },
  { key: 'suspended', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
]
