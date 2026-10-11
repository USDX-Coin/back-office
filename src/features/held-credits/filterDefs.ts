import type { ColumnConfig } from '@/components/table/types'

// TIDAK ADA `FilterDef` di berkas ini, dan itu keputusan yang disengaja:
// `ListHeldCreditsDto` hanya menerima `page` + `take`. Memasang popover saringan
// berarti menulis parameter yang dibuang diam-diam oleh ValidationPipe
// (`whitelist: true` tanpa `forbidNonWhitelisted`) — antrean akan tampak
// menyusut padahal server mengirim halaman yang sama.

/** Id kolom harus sama dengan id ColumnDef di HeldCreditsPage. */
export const HELD_CREDIT_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'receivedAt', label: 'Uang masuk' },
  // Sebab tertahan dan nominal tidak bisa disembunyikan: keduanya adalah
  // "kenapa ini ada di sini" dan "berapa uangnya".
  { key: 'problem', label: 'Kenapa tertahan', required: true },
  { key: 'amount', label: 'Nominal masuk', required: true },
  { key: 'payer', label: 'Pengirim' },
  { key: 'order', label: 'Order pilihan mesin' },
  { key: 'age', label: 'Umur antrean' },
]
