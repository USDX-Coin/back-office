// USDX-154: filter / column config for the KYC review list (/kyc).
// Contract: sot/api/kyc.yaml § list. No sort config on purpose — the endpoint
// exposes no sort params; order is fixed at submitted_at ascending.
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const KYC_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    // No UNVERIFIED option: a kyc row only exists once the user submits, which
    // moves status to PENDING (week1.md § Status Flow). "All" = no param sent.
    options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'VERIFIED', label: 'Verified' },
      { value: 'REJECTED', label: 'Rejected' },
    ],
  },
  {
    kind: 'select',
    key: 'entityType',
    label: 'Entity type',
    options: [
      { value: 'INDIVIDUAL', label: 'Individual' },
      // Week 1 is KYC INDIVIDUAL only — KYB/LEGAL_ENTITY defers to Week 2+
      // (week1.md § Out-of-scope). Rendered greyed-out per the Linear AC.
      {
        value: 'LEGAL_ENTITY',
        label: 'Legal entity',
        disabled: true,
        disabledHint: 'Week 2+',
      },
    ],
  },
  // BE filters submitted_at, date-only YYYY-MM-DD in Asia/Jakarta
  // (sot/api/kyc.yaml § list startDate/endDate).
  {
    kind: 'dateRange',
    startKey: 'startDate',
    endKey: 'endDate',
    label: 'Submitted date',
  },
]

// Column ids must match the ColumnDef ids in KycListPage.
export const KYC_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'id', label: 'ID', required: true },
  { key: 'userEmail', label: 'User Email', required: true },
  { key: 'entityType', label: 'Entity Type' },
  { key: 'status', label: 'Status' },
  { key: 'submittedAt', label: 'Submitted At' },
  { key: 'submissionCount', label: 'Submissions' },
]
