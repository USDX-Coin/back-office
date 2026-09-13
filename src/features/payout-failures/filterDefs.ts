// USDX-662 — filter + kolom antrean Pencairan Bermasalah (/payout-failures).
//
// Satu filter saja, `issueKind`, karena hanya itu yang diterima kontraknya
// (`page` + `take` + `issueKind`). Tidak ada popover Sort: urutannya keputusan
// server (terlama dulu, fairness). Toolbar tetap dipasang supaya `DataTable`
// tidak merender kotak Search + isian tanggal bawaannya, yang akan menulis
// parameter yang endpoint ini abaikan.
import type { ColumnConfig, FilterDef } from '@/components/table/types'
import { PAYOUT_ISSUE_KIND_OPTIONS } from '@/lib/payoutFailures'

export const PAYOUT_FAILURE_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'issueKind',
    label: 'Jenis masalah',
    options: PAYOUT_ISSUE_KIND_OPTIONS,
  },
]

/** Id kolom harus sama dengan id ColumnDef di PayoutFailuresPage. */
export const PAYOUT_FAILURE_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'issueAt', label: 'Masuk antrean' },
  // Jenis, nominal, dan rekening tidak bisa disembunyikan: ketiganya adalah
  // "apa yang salah", "berapa", dan "ke mana" — pertanyaan yang dijawab tiap baris.
  { key: 'issue', label: 'Masalah', required: true },
  { key: 'amount', label: 'Nominal', required: true },
  { key: 'destination', label: 'Rekening tujuan', required: true },
  { key: 'owner', label: 'Pemilik order' },
  { key: 'age', label: 'Umur antrean' },
]
