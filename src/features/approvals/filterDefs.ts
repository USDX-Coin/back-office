import type { ColumnConfig, FilterDef } from '@/components/table/types'
import { APPROVAL_ACTION_TYPE_OPTIONS, APPROVAL_STATUS_OPTIONS } from './labels'

// Dua saringan, persis yang diterima `ListApprovalsDto`: `status` + `actionType`.
// Tidak ada popover Sort — urutannya keputusan server (usulan terbaru dulu).
export const APPROVAL_FILTER_DEFS: FilterDef[] = [
  { kind: 'select', key: 'status', label: 'Keadaan', options: APPROVAL_STATUS_OPTIONS },
  {
    kind: 'select',
    key: 'actionType',
    label: 'Jenis usulan',
    options: APPROVAL_ACTION_TYPE_OPTIONS,
  },
]

/** Id kolom harus sama dengan id ColumnDef di ApprovalsPage. */
export const APPROVAL_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'proposedAt', label: 'Diusulkan' },
  // Jenis, nominal dan keadaan tidak bisa disembunyikan: ketiganya "apa yang
  // diusulkan", "berapa rupiah yang dipertaruhkan", "masih menunggu atau tidak".
  { key: 'actionType', label: 'Usulan', required: true },
  { key: 'amount', label: 'Nominal', required: true },
  { key: 'status', label: 'Keadaan', required: true },
  { key: 'proposer', label: 'Pengusul' },
  { key: 'deadline', label: 'Batas waktu' },
]
