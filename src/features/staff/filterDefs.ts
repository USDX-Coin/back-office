// USDX-27: filter / sort / column config for the staff list (TableToolbar).
// Note: staff filtering + sorting + paginating runs entirely client-side
// because sot/api/staff.yaml only exposes `page` + `limit` today (see comment
// at top of StaffPage.tsx).
//
// Nama peran (`ADMIN` / `MANAGER` / `STAFF` / `DEVELOPER`) TIDAK diterjemahkan
// dan ditulis persis seperti nilai enumnya: itu kata yang dipakai gerbang akses
// di kode dan yang disebut di dokumen tim, jadi "Manajer" di layar akan membuat
// operator mencari peran yang tidak ada namanya di tempat lain mana pun.
import type {
  ColumnConfig,
  FilterDef,
  SortColumnDef,
} from '@/components/table/types'

export const STAFF_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'role',
    label: 'Peran',
    options: [
      { value: 'STAFF', label: 'STAFF' },
      { value: 'MANAGER', label: 'MANAGER' },
      { value: 'DEVELOPER', label: 'DEVELOPER' },
      { value: 'ADMIN', label: 'ADMIN' },
    ],
  },
  {
    kind: 'select',
    key: 'active',
    label: 'Status',
    options: [
      { value: 'active', label: 'Aktif' },
      { value: 'inactive', label: 'Nonaktif' },
    ],
  },
]

export const STAFF_SORT_COLUMNS: SortColumnDef[] = [
  { id: 'name', label: 'Nama' },
  { id: 'email', label: 'Email' },
  { id: 'role', label: 'Peran' },
  { id: 'isActive', label: 'Status' },
  { id: 'createdAt', label: 'Dibuat' },
]

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef.
export const STAFF_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'name', label: 'Nama', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Peran' },
  { key: 'isActive', label: 'Status' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: 'Aksi', required: true },
]
