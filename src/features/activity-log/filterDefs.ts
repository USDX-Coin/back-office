import type { ColumnConfig, FilterDef } from '@/components/table/types'
import { OUTCOME_OPTIONS, RESOURCE_TYPE_OPTIONS } from './labels'
import type { DirectoryStaff } from '@/features/staff-directory/hooks'

// Saringan Jejak Audit. Hanya yang diterima `ListActivityLogsDto` — lihat
// catatan panjang di `types.ts` tentang parameter tak dikenal yang dibuang
// diam-diam oleh ValidationPipe.
//
// `actorStaffId` sengaja BUKAN isian teks berisi UUID: pemeriksa mencari nama
// orang, bukan kunci primer. Pilihannya dibangun dari direktori staf.
export function activityLogFilterDefs(staff: DirectoryStaff[]): FilterDef[] {
  return [
    // Paling depan, dan bukan kebetulan: pemeriksa selalu bertanya dengan
    // tanggal ("apa yang terjadi 12 September"). Tanpa ini satu-satunya cara
    // sampai ke sana adalah memijak halaman satu per satu.
    //
    // `(WIB)` ditulis di labelnya karena nilainya distempel +07:00 sebelum
    // dikirim — operator yang mengira ini UTC akan salah baca batasnya,
    // dan bentuknya sengaja sama persis dengan Log Panggilan DurianPay.
    {
      kind: 'dateRange',
      startKey: 'from',
      endKey: 'to',
      label: 'Tanggal kejadian (WIB)',
    },
    {
      kind: 'select',
      key: 'actorStaffId',
      label: 'Aktor (staf)',
      options: staff.map((s) => ({
        value: s.id,
        label: s.isActive ? s.name : `${s.name} (nonaktif)`,
      })),
    },
    {
      kind: 'select',
      key: 'resourceType',
      label: 'Kelompok objek',
      options: RESOURCE_TYPE_OPTIONS,
    },
    { kind: 'select', key: 'outcome', label: 'Hasil', options: OUTCOME_OPTIONS },
  ]
}

/** Id kolom harus sama dengan id ColumnDef di ActivityLogPage. */
export const ACTIVITY_LOG_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'createdAt', label: 'Waktu' },
  // Aktor, aksi, objek dan hasil tidak bisa disembunyikan: keempatnya adalah
  // pertanyaan yang dijawab tiap baris ("siapa mengubah apa, berhasil atau
  // tidak"). Menyembunyikannya membuat barisnya berhenti berarti.
  { key: 'actor', label: 'Aktor', required: true },
  { key: 'action', label: 'Aksi', required: true },
  { key: 'object', label: 'Objek', required: true },
  { key: 'outcome', label: 'Hasil', required: true },
  { key: 'ip', label: 'Dari mana' },
]
