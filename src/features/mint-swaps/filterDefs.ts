// D29 — saringan + kolom "Swap IDR→USD" dan "Swap Bermasalah".
//
// Kontrak list hanya menerima `status` + `from`/`to` (tanggal WIB `queuedAt`).
// Antrean Swap Bermasalah tidak punya saringan: statusnya tetap `NEEDS_ACTION` dan
// urutannya keputusan server (terlama dulu). Toolbar tetap dipasang (Kolom saja)
// supaya `DataTable` tidak merender kotak Search bawaan yang tidak dikenal endpoint.
import type { ColumnConfig, FilterDef } from '@/components/table/types'
import { MINT_SWAP_STATUS_OPTIONS } from '@/lib/mintSwaps'

export const MINT_SWAP_FILTER_DEFS: FilterDef[] = [
  { kind: 'select', key: 'status', label: 'Status', options: MINT_SWAP_STATUS_OPTIONS },
  { kind: 'dateRange', startKey: 'from', endKey: 'to', label: 'Masuk antrean (WIB)' },
]

/** Id kolom = id ColumnDef di `columns.tsx`. */
export const MINT_SWAP_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'queuedAt', label: 'Masuk antrean' },
  { key: 'status', label: 'Status', required: true },
  { key: 'customer', label: 'Nasabah' },
  { key: 'amount', label: 'USDX & rupiah', required: true },
  { key: 'usd', label: 'Dolar diterima' },
  { key: 'attempts', label: 'Percobaan' },
  { key: 'waiting', label: 'Lama' },
]

export const MINT_SWAP_ISSUE_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'queuedAt', label: 'Masuk antrean' },
  { key: 'issue', label: 'Alasan', required: true },
  { key: 'customer', label: 'Nasabah' },
  { key: 'amount', label: 'Nominal', required: true },
  { key: 'attempts', label: 'Percobaan' },
  { key: 'waiting', label: 'Menunggu', required: true },
]
