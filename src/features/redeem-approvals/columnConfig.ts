// USDX-669 — kolom antrean Persetujuan Pencairan (/redeem-approvals).
//
// HANYA konfigurasi kolom. Tidak ada `FilterDef` dan tidak ada `SortColumnDef`,
// dan itu mengikuti kontraknya: `GET /api/v1/redeem-approvals` menerima `page`
// dan `take` — tidak satu pun parameter saring atau urut. Urutannya sendiri
// keputusan server (`burned_at` asc, terlama dulu, fairness).
//
// Toolbar-nya tetap dipasang meski hanya membawa popover Kolom, karena
// `DataTable` yang TIDAK diberi `filterToolbar` merender toolbar bawaannya:
// kotak "Search..." plus dua isian tanggal yang menulis `?search=`,
// `?startDate=`, `?endDate=` ke URL. Endpoint ini mengabaikan ketiganya, jadi
// kontrol itu hanya membuat operator mengira antreannya sudah disaring padahal
// tidak — keadaan yang lebih buruk daripada tidak punya saringan sama sekali.
import type { ColumnConfig } from '@/components/table/types'

export const REDEEM_APPROVAL_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'order', label: 'Order', required: true },
  // Nominal dan rekening tujuan tidak bisa disembunyikan: keduanya adalah
  // pertanyaan yang harus dijawab tiap baris ("berapa" dan "ke mana"), dan
  // antrean yang menyembunyikan salah satunya masih menampilkan tombol Setujui.
  { key: 'amount', label: 'Nominal transfer', required: true },
  { key: 'destination', label: 'Rekening tujuan', required: true },
  { key: 'customer', label: 'Nasabah' },
  { key: 'burnedAt', label: 'Dibakar' },
]
