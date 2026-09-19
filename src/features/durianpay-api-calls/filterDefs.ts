// Saringan + kolom layar "Log Panggilan DurianPay" (/durianpay-api-calls).
//
// Daftarnya PERSIS `ListDurianpayApiCallsDto` di backend dan tidak satu pun
// lebih: waktu, outcome, flavor, awalan path, referenceNo, httpStatus,
// responseCode. **Tidak ada kotak cari teks bebas**, karena tidak ada
// endpoint yang bisa menjawabnya — badan pesan tidak ter-index dan backend tidak
// menyediakan pencarian ke dalamnya. Kotak cari yang tidak didukung lebih buruk
// daripada tidak punya kotak cari: operator yang mengetik nomor VA lalu melihat
// tabel kosong akan menyimpulkan panggilannya tidak pernah terjadi.
//
// Toolbar-nya sendiri wajib ada bukan cuma demi saringan ini: `DataTable` TANPA
// `filterToolbar` merender kotak Search + dua isian tanggal bawaannya, yang
// menulis `?search=` / `?startDate=` / `?endDate=` — tiga parameter yang endpoint
// ini abaikan (preseden /redeem-approvals).
import type { ColumnConfig, FilterDef } from '@/components/table/types'
import {
  DURIANPAY_PATH_FILTER_MAX,
  DURIANPAY_REFERENCE_FILTER_MAX,
  DURIANPAY_RESPONSE_CODE_FILTER_MAX,
} from '@/lib/durianpayApiCalls'

export const DURIANPAY_CALL_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'dateRange',
    startKey: 'from',
    endKey: 'to',
    label: 'Tanggal panggilan (WIB)',
  },
  {
    kind: 'select',
    key: 'outcome',
    label: 'Hasil',
    options: [
      { value: 'SUCCESS', label: 'Sampai & dijawab' },
      { value: 'REJECTED', label: 'Ditolak' },
      { value: 'UNAVAILABLE', label: 'Tidak jelas' },
    ],
  },
  {
    kind: 'text',
    key: 'referenceNo',
    label: 'Nomor order',
    placeholder: 'mis. RDM7K2X9QP',
    hint: 'Cocok PERSIS dengan referensi kita (trxId / partnerReferenceNo).',
    maxLength: DURIANPAY_REFERENCE_FILTER_MAX,
  },
  {
    kind: 'text',
    key: 'path',
    label: 'Endpoint',
    placeholder: 'mis. /v1.0/transfer-va',
    hint: 'Cocok sebagai AWALAN path — /v1.0/transfer-va menangkap create-va dan inquiry-va sekaligus.',
    maxLength: DURIANPAY_PATH_FILTER_MAX,
  },
  {
    kind: 'select',
    key: 'apiFlavor',
    label: 'Integrasi',
    options: [
      { value: 'SNAP', label: 'SNAP' },
      { value: 'LEGACY', label: 'Jalur lama (Legacy)' },
    ],
  },
  {
    kind: 'text',
    key: 'httpStatus',
    label: 'Status HTTP',
    placeholder: 'mis. 500',
    hint: 'Tiga angka persis, 100–599.',
    maxLength: 3,
    inputMode: 'numeric',
  },
  {
    kind: 'text',
    key: 'responseCode',
    label: 'Kode jawaban DurianPay',
    placeholder: 'mis. 5002701',
    hint: 'Cocok PERSIS dengan responseCode SNAP atau error_code jalur lama.',
    maxLength: DURIANPAY_RESPONSE_CODE_FILTER_MAX,
  },
]

/**
 * Id kolom harus sama dengan id ColumnDef di `DurianpayApiCallsPage`.
 *
 * Lima kolom pertama menjawab pertanyaan operator tanpa perlu paham SNAP —
 * kapan, apa yang dipanggil, berhasil atau tidak, kenapa gagal, order mana — dan
 * kelimanya TIDAK bisa disembunyikan. Dua terakhir teknis: lama panggilan dan
 * integrasi mana yang dipakai. `Integrasi` mati secara bawaan: SNAP vs Legacy
 * adalah beda kredensial dan amplop error, pertanyaan engineer, bukan pertanyaan
 * orang yang sedang mencari uang nasabah.
 */
export const DURIANPAY_CALL_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'requestedAt', label: 'Waktu (WIB)', required: true },
  { key: 'call', label: 'Panggilan', required: true },
  { key: 'outcome', label: 'Hasil', required: true },
  { key: 'cause', label: 'Kenapa', required: true },
  { key: 'reference', label: 'Order', required: true },
  { key: 'duration', label: 'Lama' },
  { key: 'flavor', label: 'Integrasi', hiddenByDefault: true },
]
