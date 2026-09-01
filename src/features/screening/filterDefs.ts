// USDX-588 — konfigurasi filter / kolom antrean screening (/screening).
//
// TIDAK ada konfigurasi urutan, dan bukan karena urutannya sebuah kebijakan
// seperti pada antrean KYC/KYB: `GET /api/v1/screening/results` sama sekali
// tidak menerima parameter urutan. Menyediakan popover Sort di sini berarti
// menawarkan kendali yang tidak mengubah apa pun.
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const SCREENING_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'queue',
    label: 'Antrean',
    options: [
      { value: 'open', label: 'Masih menahan subjek' },
      { value: 'all', label: 'Semua jejak pemeriksaan' },
    ],
  },
  {
    kind: 'select',
    key: 'subjectType',
    label: 'Jenis subjek',
    options: [
      { value: 'KYC', label: 'Nasabah perorangan' },
      { value: 'KYC_UBO', label: 'Pemilik manfaat (UBO)' },
      { value: 'KYB', label: 'Badan usaha' },
    ],
  },
  {
    kind: 'select',
    key: 'outcome',
    label: 'Hasil',
    // Lima nilai `screening_outcome` seluruhnya — termasuk dua yang ditulis
    // PETUGAS. `outcome` menyaring kolom pada baris TEMUAN, dan baris keputusan
    // tidak pernah muncul sendiri (`decisionOfId IS NULL` di server), jadi
    // menyaring `CLEARED` di sini mengembalikan temuan yang hasil MESINnya
    // `CLEARED` — bukan temuan yang DIPUTUS `CLEARED`. Yang terakhir itu dicari
    // lewat filter Antrean di atas.
    options: [
      { value: 'POTENTIAL_MATCH', label: 'Berpotensi cocok' },
      { value: 'NO_MATCH', label: 'Tidak cocok' },
      { value: 'LIST_UNAVAILABLE', label: 'Daftar tidak tersedia' },
    ],
  },
]

/**
 * Id kolom harus sama dengan id ColumnDef di ScreeningQueuePage.
 *
 * Tidak ada kolom "Nama nasabah", dan itu bukan kelalaian: `screening_results`
 * sengaja tidak menyimpan nama subjek (tabelnya append-only, jadi PII di sana
 * jadi PII yang tidak bisa dihapus sweeper retensi). Yang bisa ditampilkan
 * antrean hanyalah jenis subjek dan idnya; namanya baru muncul di layar banding,
 * lewat pembacaan teraudit ke endpoint KYC/KYB-nya sendiri.
 */
export const SCREENING_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'score', label: 'Skor', required: true },
  { key: 'matchedName', label: 'Nama pada daftar', required: true },
  { key: 'subject', label: 'Subjek' },
  { key: 'outcome', label: 'Hasil' },
  { key: 'decision', label: 'Keputusan' },
  { key: 'list', label: 'Daftar' },
  { key: 'trigger', label: 'Pemicu' },
  { key: 'createdAt', label: 'Diperiksa' },
]

export const SANCTION_LIST_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'listType',
    label: 'Jenis daftar',
    options: [
      { value: 'DTTOT', label: 'DTTOT' },
      { value: 'DPPSPM', label: 'DPPSPM' },
    ],
  },
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'ACTIVE', label: 'Aktif' },
      { value: 'DRAFT', label: 'Draft' },
      { value: 'SUPERSEDED', label: 'Digantikan' },
    ],
  },
]
