// USDX-27: filter / sort / column config for the staff list (TableToolbar).
// Note: staff filtering + sorting + paginating runs entirely client-side
// because sot/api/staff.yaml only exposes `page` + `limit` today (see comment
// at top of StaffPage.tsx).
import type {
  ColumnConfig,
  FilterDef,
  SortColumnDef,
} from '@/components/table/types'

export const STAFF_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'role',
    label: 'Role',
    options: [
      { value: 'STAFF', label: 'Staff' },
      { value: 'MANAGER', label: 'Manager' },
      { value: 'DEVELOPER', label: 'Developer' },
      { value: 'ADMIN', label: 'Admin' },
    ],
  },
  {
    kind: 'select',
    key: 'active',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
]

export const STAFF_SORT_COLUMNS: SortColumnDef[] = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'role', label: 'Role' },
  { id: 'isActive', label: 'Status' },
  { id: 'createdAt', label: 'Created' },
]

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef.
export const STAFF_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'isActive', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions', required: true },
]
