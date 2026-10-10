// USDX-27: filter / column config for the users list (TableToolbar).
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const USERS_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'kycStatus',
    label: 'KYC',
    options: [
      { value: 'UNVERIFIED', label: 'Belum diverifikasi' },
      { value: 'PENDING', label: 'Menunggu' },
      { value: 'VERIFIED', label: 'Terverifikasi' },
      { value: 'REJECTED', label: 'Ditolak' },
    ],
  },
  {
    kind: 'select',
    key: 'entityType',
    label: 'Jenis',
    options: [
      { value: 'INDIVIDUAL', label: 'Perorangan' },
      { value: 'LEGAL_ENTITY', label: 'Badan Usaha' },
    ],
  },
  // USDX-156 — sot/api/users.yaml § activationStatus. "All" = no param sent.
  // Label status aktivasi disalin dari `src/lib/status.ts` supaya filter dan
  // badge di kolomnya tidak pernah menyebut keadaan yang sama dengan dua kata.
  {
    kind: 'select',
    key: 'activationStatus',
    label: 'Aktivasi',
    options: [
      { value: 'PENDING', label: 'Menunggu aktivasi' },
      { value: 'ACTIVATED', label: 'Aktif' },
      { value: 'FAILED', label: 'Email gagal terkirim' },
    ],
  },
]

// Column ids must match the TanStack ColumnDef ids in UsersPage.
export const USERS_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'name', label: 'Nama', required: true },
  { key: 'email', label: 'Email' },
  { key: 'entityType', label: 'Jenis' },
  { key: 'kycStatus', label: 'KYC' },
  { key: 'activation', label: 'Aktivasi' },
  { key: 'suspended', label: 'Status' },
  { key: 'actions', label: 'Aksi', required: true },
]
