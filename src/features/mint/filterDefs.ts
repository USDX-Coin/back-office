// USDX-27: filter / sort / column config for the request list (shared by both
// MintListPage and BurnListPage — they hit the same `/api/v1/requests` endpoint
// so the schema is the same). Burn imports from here on purpose.
import type {
  ColumnConfig,
  FilterDef,
  SortColumnDef,
} from '@/components/table/types'

export const REQUEST_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'PENDING_APPROVAL', label: 'Menunggu persetujuan' },
      { value: 'APPROVED', label: 'Disetujui' },
      { value: 'EXECUTED', label: 'Sudah dieksekusi' },
      { value: 'IDR_TRANSFERRED', label: 'Rupiah sudah ditransfer' },
      { value: 'REJECTED', label: 'Ditolak' },
    ],
  },
  {
    kind: 'select',
    key: 'chain',
    label: 'Jaringan',
    options: [
      { value: 'ethereum', label: 'Ethereum' },
      { value: 'polygon', label: 'Polygon' },
      { value: 'arbitrum', label: 'Arbitrum' },
      { value: 'base', label: 'Base' },
    ],
  },
  {
    kind: 'select',
    // Kolom "Safe" lama hanya menyebut nama teknisnya. Yang perlu dibaca
    // operator adalah dompet MANA yang memegang request ini — kata yang sama
    // dipakai modal detail ("Dompet Staf" / "Dompet Manager"). Nilai wire
    // STAFF/MANAGER tidak berubah.
    key: 'safeType',
    label: 'Dompet',
    options: [
      { value: 'STAFF', label: 'Dompet Staf' },
      { value: 'MANAGER', label: 'Dompet Manager' },
    ],
  },
  // USDX-98: BE GET /api/v1/requests accepts startDate/endDate (YYYY-MM-DD,
  // Asia/Jakarta). USDX-27 shipped the generic dateRange capability but never
  // wired it into the request lists — this is that wiring.
  {
    kind: 'dateRange',
    startKey: 'startDate',
    endKey: 'endDate',
    label: 'Rentang tanggal',
  },
]

// Date column is the only field BE supports sorting by today (the requests
// hooks pass `sortBy` straight through but only `createdAt` is documented in
// `sot/api/requests.yaml`). Add more entries here once the contract grows.
export const REQUEST_SORT_COLUMNS: SortColumnDef[] = [
  { id: 'createdAt', label: 'Tanggal' },
]

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef in
// MintListPage / BurnListPage.
// Kosakata kolomnya SENGAJA sama persis dengan tabel Transaksi Nasabah
// (`features/transactions/filterDefs.ts`): ketiga layar menangani order yang
// sama, dan kolom yang sama harus berbunyi sama supaya operator tidak perlu
// menerjemahkan sendiri saat berpindah layar.
export const REQUEST_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'createdAt', label: 'Tanggal', required: true },
  { key: 'user', label: 'Nasabah', required: true },
  { key: 'amount', label: 'Nominal', required: true },
  { key: 'chain', label: 'Jaringan' },
  { key: 'safeType', label: 'Dompet' },
  { key: 'status', label: 'Status' },
  { key: 'onchainTx', label: 'Bukti blockchain' },
  { key: 'safeTx', label: 'Antrean tanda tangan' },
]
