// USDX-546 — filter / column config for the KYB review list (/kyb).
// Mirrors `features/kyc/filterDefs.ts`: no sort config, because the queue order
// is a fairness policy (oldest submission first), not an operator preference.
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const KYB_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    // No UNVERIFIED option: a `kyb` row only exists once an operator has entered
    // it, which starts it at PENDING — the same rule as the retail `kyc` row.
    options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'VERIFIED', label: 'Verified' },
      { value: 'REJECTED', label: 'Rejected' },
    ],
  },
]

/**
 * Column ids must match the ColumnDef ids in KybListPage.
 *
 * No NIB and no UBO count: `GET /api/v1/kyb` returns neither. The entity name and
 * the NIB are encrypted columns the list query cannot read, and the UBO count is
 * not in the payload — the zero-UBO condition is enforced at approve
 * (`409 KYB_NO_UBO`) and shown on the review screen instead.
 */
export const KYB_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'id', label: 'ID', required: true },
  { key: 'userName', label: 'Entity', required: true },
  { key: 'userEmail', label: 'Account email' },
  { key: 'entityForm', label: 'Legal form' },
  { key: 'status', label: 'Status' },
  { key: 'submittedAt', label: 'Submitted At' },
  { key: 'submissionCount', label: 'Submissions' },
]
