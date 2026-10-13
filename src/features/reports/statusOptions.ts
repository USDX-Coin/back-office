import { getRequestStatusConfig } from '@/lib/status'
import type { StatusOption } from './ReportFiltersToolbar'

// Label diambil dari peta `Record<Enum, StatusConfig>` di `src/lib/status.ts`,
// bukan dari salinan kedua yang bisa menyimpang diam-diam dari layar lain
// (pola yang sama dulu dipakai Beranda, yang dihapus di redesain fase 1).
//
// `value` adalah nilai wire — JANGAN diterjemahkan.

// MintStatus enum from sot/api/mint.yaml.
export const MINT_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'PENDING_APPROVAL', label: getRequestStatusConfig('PENDING_APPROVAL').label },
  { value: 'APPROVED', label: getRequestStatusConfig('APPROVED').label },
  { value: 'EXECUTED', label: getRequestStatusConfig('EXECUTED').label },
  { value: 'REJECTED', label: getRequestStatusConfig('REJECTED').label },
] as const

// BurnStatus enum from sot/api/burn.yaml.
export const BURN_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'PENDING_APPROVAL', label: getRequestStatusConfig('PENDING_APPROVAL').label },
  { value: 'APPROVED', label: getRequestStatusConfig('APPROVED').label },
  { value: 'EXECUTED', label: getRequestStatusConfig('EXECUTED').label },
  { value: 'IDR_TRANSFERRED', label: getRequestStatusConfig('IDR_TRANSFERRED').label },
  { value: 'REJECTED', label: getRequestStatusConfig('REJECTED').label },
] as const
