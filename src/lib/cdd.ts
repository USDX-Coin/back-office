/**
 * Human labels for the CDD / KYB value sets (USDX-545, USDX-546).
 *
 * The wire values are UPPER_SNAKE enums copied from the partner cluster
 * (`partner_customer_kyc.ts`); a reviewer should not have to read
 * `FROM_100M_TO_500M` off the screen. Kept in `lib/` rather than inline in the
 * modal so the mapping is exhaustive by type (`Record<Enum, string>` fails the
 * build when a value is added to the union and forgotten here) and testable
 * without React.
 *
 * `formatEnumLabel` is the fallback for a value the backend adds before the
 * front end knows about it: it renders `NEW_VALUE` as "New value" instead of
 * showing an empty cell, which is the difference between "unmapped label" and
 * "missing data" for whoever is looking at it.
 */
import type {
  KycAnnualIncomeRange,
  KycGender,
  KycMaritalStatus,
  KycNetWorthRange,
  KycOccupation,
  KycSourceOfFunds,
  KycSourceOfWealth,
  KycTransactionPurpose,
  KybDocumentSlot,
  KybEntityForm,
  UboCascadeStep,
  UboLegalRelationship,
} from './types'

/**
 * 99 jenis pekerjaan Permendagri 109/2019 (F-1.01 butir 31), label persis
 * sebagaimana tercetak di daftar resmi — termasuk garis miring, kurung, dan
 * ejaan `Cheff` (kode 92, ejaan asli Permendagri, bukan salah ketik).
 *
 * Labelnya TIDAK diterjemahkan atau dirapikan: petugas mencocokkan jawaban ini
 * dengan kolom "Pekerjaan" di KTP-el yang diunggah nasabah, dan label yang
 * memakai kata lain memaksa penerjemahan di kepala saat memeriksa.
 *
 * Angka di komentar adalah kode Permendagri — berguna mencocokkan dengan data
 * Dukcapil, bukan bagian dari nilai enum.
 */
export const OCCUPATION_LABELS: Record<KycOccupation, string> = {
  BELUM_TIDAK_BEKERJA:            'Belum/Tidak Bekerja',               // 1
  MENGURUS_RUMAH_TANGGA:          'Mengurus Rumah Tangga',             // 2
  PELAJAR_MAHASISWA:              'Pelajar/Mahasiswa',                 // 3
  PENSIUNAN:                      'Pensiunan',                         // 4
  PEGAWAI_NEGERI_SIPIL:           'Pegawai Negeri Sipil (PNS)',        // 5
  TENTARA_NASIONAL_INDONESIA:     'Tentara Nasional Indonesia (TNI)',  // 6
  KEPOLISIAN_RI:                  'Kepolisian RI (POLRI)',             // 7
  PERDAGANGAN:                    'Perdagangan',                       // 8
  PETANI_PEKEBUN:                 'Petani/Pekebun',                    // 9
  PETERNAK:                       'Peternak',                          // 10
  NELAYAN_PERIKANAN:              'Nelayan/Perikanan',                 // 11
  INDUSTRI:                       'Industri',                          // 12
  KONSTRUKSI:                     'Konstruksi',                        // 13
  TRANSPORTASI:                   'Transportasi',                      // 14
  KARYAWAN_SWASTA:                'Karyawan Swasta',                   // 15
  KARYAWAN_BUMN:                  'Karyawan BUMN',                     // 16
  KARYAWAN_BUMD:                  'Karyawan BUMD',                     // 17
  KARYAWAN_HONORER:               'Karyawan Honorer',                  // 18
  BURUH_HARIAN_LEPAS:             'Buruh Harian Lepas',                // 19
  BURUH_TANI_PERKEBUNAN:          'Buruh Tani/Perkebunan',             // 20
  BURUH_NELAYAN_PERIKANAN:        'Buruh Nelayan/Perikanan',           // 21
  BURUH_PETERNAKAN:               'Buruh Peternakan',                  // 22
  PEMBANTU_RUMAH_TANGGA:          'Pembantu Rumah Tangga',             // 23
  TUKANG_CUKUR:                   'Tukang Cukur',                      // 24
  TUKANG_LISTRIK:                 'Tukang Listrik',                    // 25
  TUKANG_BATU:                    'Tukang Batu',                       // 26
  TUKANG_KAYU:                    'Tukang Kayu',                       // 27
  TUKANG_SOL_SEPATU:              'Tukang Sol Sepatu',                 // 28
  TUKANG_LAS_PANDAI_BESI:         'Tukang Las/Pandai Besi',            // 29
  TUKANG_JAHIT:                   'Tukang Jahit',                      // 30
  TUKANG_GIGI:                    'Tukang Gigi',                       // 31
  PENATA_RIAS:                    'Penata Rias',                       // 32
  PENATA_BUSANA:                  'Penata Busana',                     // 33
  PENATA_RAMBUT:                  'Penata Rambut',                     // 34
  MEKANIK:                        'Mekanik',                           // 35
  SENIMAN:                        'Seniman',                           // 36
  TABIB:                          'Tabib',                             // 37
  PARAJI:                         'Paraji',                            // 38
  PERANCANG_BUSANA:               'Perancang Busana',                  // 39
  PENTERJEMAH:                    'Penterjemah',                       // 40
  IMAM_MASJID:                    'Imam Masjid',                       // 41
  PENDETA:                        'Pendeta',                           // 42
  PASTOR:                         'Pastor',                            // 43
  WARTAWAN:                       'Wartawan',                          // 44
  USTADZ_MUBALIGH:                'Ustadz/Mubaligh',                   // 45
  JURU_MASAK:                     'Juru Masak',                        // 46
  PROMOTOR_ACARA:                 'Promotor Acara',                    // 47
  ANGGOTA_DPR_RI:                 'Anggota DPR-RI',                    // 48
  ANGGOTA_DPD:                    'Anggota DPD',                       // 49
  ANGGOTA_BPK:                    'Anggota BPK',                       // 50
  PRESIDEN:                       'Presiden',                          // 51
  WAKIL_PRESIDEN:                 'Wakil Presiden',                    // 52
  ANGGOTA_MAHKAMAH_KONSTITUSI:    'Anggota Mahkamah Konstitusi',       // 53
  ANGGOTA_KABINET_KEMENTERIAN:    'Anggota Kabinet/Kementerian',       // 54
  DUTA_BESAR_KEPALA_PERWAKILAN:   'Duta Besar/Kepala Perwakilan',      // 55
  GUBERNUR:                       'Gubernur',                          // 56
  WAKIL_GUBERNUR:                 'Wakil Gubernur',                    // 57
  BUPATI:                         'Bupati',                            // 58
  WAKIL_BUPATI:                   'Wakil Bupati',                      // 59
  WALIKOTA:                       'Walikota',                          // 60
  WAKIL_WALIKOTA:                 'Wakil Walikota',                    // 61
  ANGGOTA_DPRD_PROVINSI:          'Anggota DPRD Provinsi',             // 62
  ANGGOTA_DPRD_KAB_KOTA:          'Anggota DPRD Kab/Kota',             // 63
  DOSEN:                          'Dosen',                             // 64
  GURU:                           'Guru',                              // 65
  PILOT:                          'Pilot',                             // 66
  PENGACARA:                      'Pengacara',                         // 67
  NOTARIS:                        'Notaris',                           // 68
  ARSITEK:                        'Arsitek',                           // 69
  AKUNTAN:                        'Akuntan',                           // 70
  KONSULTAN:                      'Konsultan',                         // 71
  DOKTER:                         'Dokter',                            // 72
  BIDAN:                          'Bidan',                             // 73
  PERAWAT:                        'Perawat',                           // 74
  APOTEKER:                       'Apoteker',                          // 75
  PSIKIATER_PSIKOLOG:             'Psikiater/Psikolog',                // 76
  PENYIAR_TELEVISI:               'Penyiar Televisi',                  // 77
  PENYIAR_RADIO:                  'Penyiar Radio',                     // 78
  PELAUT:                         'Pelaut',                            // 79
  PENELITI:                       'Peneliti',                          // 80
  SOPIR:                          'Sopir',                             // 81
  PIALANG:                        'Pialang',                           // 82
  PARANORMAL:                     'Paranormal',                        // 83
  PEDAGANG:                       'Pedagang',                          // 84
  PERANGKAT_DESA:                 'Perangkat Desa',                    // 85
  KEPALA_DESA:                    'Kepala Desa',                       // 86
  BIARAWATI:                      'Biarawati',                         // 87
  WIRASWASTA:                     'Wiraswasta',                        // 88
  ANGGOTA_LEMBAGA_TINGGI_LAINNYA: 'Anggota Lembaga Tinggi Lainnya',    // 89
  ARTIS:                          'Artis',                             // 90
  ATLIT:                          'Atlit',                             // 91
  CHEFF:                          'Cheff',                             // 92
  MANAJER:                        'Manajer',                           // 93
  TENAGA_TATA_USAHA:              'Tenaga Tata Usaha',                 // 94
  OPERATOR:                       'Operator',                          // 95
  PEKERJA_PENGOLAHAN_KERAJINAN:   'Pekerja Pengolahan, Kerajinan',     // 96
  TEKNISI:                        'Teknisi',                           // 97
  ASISTEN_AHLI:                   'Asisten Ahli',                      // 98
  LAINNYA:                        'Lainnya',                           // 99
}

/**
 * Kode 48-63 Permendagri — seluruhnya jabatan publik, dan memetakan langsung ke
 * cakupan PEP domestik **POJK 8/2023 Pasal 2 ayat (2) huruf b** ("kepala negara
 * atau pemerintahan, politisi senior, pejabat pemerintah senior").
 *
 * Dipakai halaman review menyilangkan jawaban `pepStatus`: nasabah yang memilih
 * salah satu pekerjaan ini tapi menjawab `pepStatus = false` adalah kejanggalan
 * yang wajib ditinjau, bukan data yang lolos diam-diam. Cerminan
 * `PEP_CANDIDATE_OCCUPATIONS` di `backend/src/database/schema/partner/partner-customer-kyc.ts`
 * — satu berkas menghadap satu berkas supaya selisihnya terlihat di diff.
 */
export const PEP_CANDIDATE_OCCUPATIONS: ReadonlySet<KycOccupation> = new Set([
  'ANGGOTA_DPR_RI',                  // 48. Anggota DPR-RI
  'ANGGOTA_DPD',                     // 49. Anggota DPD
  'ANGGOTA_BPK',                     // 50. Anggota BPK
  'PRESIDEN',                        // 51. Presiden
  'WAKIL_PRESIDEN',                  // 52. Wakil Presiden
  'ANGGOTA_MAHKAMAH_KONSTITUSI',     // 53. Anggota Mahkamah Konstitusi
  'ANGGOTA_KABINET_KEMENTERIAN',     // 54. Anggota Kabinet/Kementerian
  'DUTA_BESAR_KEPALA_PERWAKILAN',    // 55. Duta Besar/Kepala Perwakilan
  'GUBERNUR',                        // 56. Gubernur
  'WAKIL_GUBERNUR',                  // 57. Wakil Gubernur
  'BUPATI',                          // 58. Bupati
  'WAKIL_BUPATI',                    // 59. Wakil Bupati
  'WALIKOTA',                        // 60. Walikota
  'WAKIL_WALIKOTA',                  // 61. Wakil Walikota
  'ANGGOTA_DPRD_PROVINSI',           // 62. Anggota DPRD Provinsi
  'ANGGOTA_DPRD_KAB_KOTA',           // 63. Anggota DPRD Kab/Kota
])

/** `true` kalau pekerjaannya jabatan publik (kode Permendagri 48-63). */
export function isPepCandidateOccupation(
  occupation: KycOccupation | null | undefined,
): boolean {
  return occupation !== null && occupation !== undefined && PEP_CANDIDATE_OCCUPATIONS.has(occupation)
}

export const SOURCE_OF_FUNDS_LABELS: Record<KycSourceOfFunds, string> = {
  SALARY: 'Salary',
  BUSINESS: 'Business',
  INVESTMENT: 'Investment',
  INHERITANCE: 'Inheritance',
  OTHER: 'Other',
}

// Amounts are rupiah — spelled out because "100M" is ambiguous in a form the
// operator reads in Indonesian.
export const ANNUAL_INCOME_LABELS: Record<KycAnnualIncomeRange, string> = {
  UNDER_100M: '< Rp 100 juta',
  FROM_100M_TO_500M: 'Rp 100 juta – 500 juta',
  FROM_500M_TO_1B: 'Rp 500 juta – 1 miliar',
  OVER_1B: '> Rp 1 miliar',
}

export const TRANSACTION_PURPOSE_LABELS: Record<KycTransactionPurpose, string> = {
  INVESTMENT: 'Investment',
  PAYMENT: 'Payment',
  REMITTANCE: 'Remittance',
  OTHER: 'Other',
}

// Rentang harta kekayaan — batas rentangnya diambil dari ambang AML yang sudah
// dipakai sistem ini (Rp500 juta per transaksi, Rp2 miliar harian), bukan dari
// angka regulasi: POJK tidak menentukan bucket. Dieja rupiah dengan alasan yang
// sama dengan `ANNUAL_INCOME_LABELS`.
export const NET_WORTH_LABELS: Record<KycNetWorthRange, string> = {
  UNDER_500M: '< Rp 500 juta',
  FROM_500M_TO_2B: 'Rp 500 juta – 2 miliar',
  FROM_2B_TO_10B: 'Rp 2 miliar – 10 miliar',
  OVER_10B: '> Rp 10 miliar',
}

export const SOURCE_OF_WEALTH_LABELS: Record<KycSourceOfWealth, string> = {
  SALARY_ACCUMULATION: 'Akumulasi gaji',
  BUSINESS_OWNERSHIP: 'Kepemilikan usaha',
  INVESTMENT_RETURN: 'Hasil investasi',
  INHERITANCE: 'Warisan',
  PROPERTY_SALE: 'Penjualan properti',
  GRANT_OR_GIFT: 'Hibah atau hadiah',
  OTHER: 'Lainnya',
}

// Kosakata KTP, tidak diterjemahkan — petugas mencocokkannya dengan KTP yang
// diunggah nasabah (alasan yang sama dengan OCCUPATION_LABELS).
export const GENDER_LABELS: Record<KycGender, string> = {
  LAKI_LAKI: 'Laki-laki',
  PEREMPUAN: 'Perempuan',
}

export const MARITAL_STATUS_LABELS: Record<KycMaritalStatus, string> = {
  BELUM_KAWIN: 'Belum Kawin',
  KAWIN: 'Kawin',
  CERAI_HIDUP: 'Cerai Hidup',
  CERAI_MATI: 'Cerai Mati',
}

/**
 * Empat bentuk hubungan hukum yang disebut Pasal 33 (3) d secara harfiah —
 * labelnya frasa pasalnya sendiri, supaya bisa ditelusuri balik ke ayatnya tanpa
 * tabel terjemahan.
 */
export const UBO_LEGAL_RELATIONSHIP_LABELS: Record<UboLegalRelationship, string> = {
  SURAT_PENUGASAN: 'Surat penugasan',
  SURAT_PERJANJIAN: 'Surat perjanjian',
  SURAT_KUASA: 'Surat kuasa',
  LAINNYA: 'Bentuk lainnya',
}

/**
 * Label langkah cascading test — ayatnya disebutkan di label karena itulah yang
 * ditanyakan pemeriksa ("langkah mana yang dipakai, dan atas dasar ayat apa").
 */
export const UBO_CASCADE_STEP_LABELS: Record<UboCascadeStep, string> = {
  KEPEMILIKAN: 'Kepemilikan — Pasal 33 (2)',
  PENGENDALIAN_BENTUK_LAIN: 'Pengendalian bentuk lain — Pasal 33 (7)',
  POSISI_DIREKSI: 'Posisi Direksi — Pasal 33 (8)',
}

/**
 * One label per value of the `kyb_entity_form` pg enum, in ITS order — the form's
 * legal-form select is derived from this map's key order, so the operator reads
 * the same sequence the database declares. Typed `Record<KybEntityForm, …>` so a
 * value added to the union without a label fails the build (USDX-546: the union
 * was four values short of the enum, and this map is what proved it).
 */
export const KYB_ENTITY_FORM_LABELS: Record<KybEntityForm, string> = {
  PT: 'PT (Perseroan Terbatas)',
  PT_PERORANGAN: 'PT Perorangan',
  CV: 'CV (Commanditaire Vennootschap)',
  FIRMA: 'Firma',
  KOPERASI: 'Koperasi',
  YAYASAN: 'Yayasan',
  PERKUMPULAN: 'Perkumpulan',
  BUMN: 'BUMN',
  BUMD: 'BUMD',
  OTHER: 'Other',
}

/**
 * Label for each of the eight fixed KYB document slots — one entry per backend
 * path column (PR #271 commit 5dc7254, migration 0077). This is the ONLY place
 * the front end names them.
 *
 * Labels are Indonesian on purpose: the backend stores no file name, so the label
 * is the only thing that identifies the document, and these are the names printed
 * on the documents themselves.
 *
 * The upload `docKind` for each slot is a SEPARATE vocabulary and lives in
 * `KYB_DOCUMENT_SLOT_DOC_KINDS` (`src/lib/kybDocumentUpload.ts`) next to the
 * size and type limits it travels with — the response says `akte`, the request
 * says `kyb_akte`, and keeping the two maps apart is how each stays readable
 * against the backend file it was transcribed from.
 *
 * Typed as a `Record<KybDocumentSlot, …>` so adding a slot to the union without
 * naming it here fails the build.
 */
export const KYB_DOCUMENT_SLOTS: Record<KybDocumentSlot, string> = {
  akte: 'Akta Pendirian',
  nib: 'NIB',
  npwp: 'NPWP Badan',
  skKemenkumham: 'SK Kemenkumham',
  ktpDireksi: 'KTP Pengurus',
  // USDX-605 — Pasal 27 (1) b angka 3, 4, 5. Label `laporanKeuangan` menyebut
  // KEDUA kemungkinannya karena pasalnya memberi pilihan ("laporan keuangan ATAU
  // deskripsi kegiatan usaha"); menyebut satu saja membuat petugas menagih
  // berkas yang tidak dimiliki perusahaan yang belum pernah diaudit.
  laporanKeuangan: 'Laporan Keuangan / Deskripsi Usaha',
  strukturManajemen: 'Struktur Manajemen',
  strukturKepemilikan: 'Struktur Kepemilikan',
}

/**
 * Render order — derived from the table above so the two can never disagree
 * (object key order is insertion order for string keys). Pinned by a test, so a
 * reorder is a deliberate act rather than a side effect of an edit.
 */
export const KYB_DOCUMENT_SLOT_KEYS = Object.keys(
  KYB_DOCUMENT_SLOTS,
) as KybDocumentSlot[]

/**
 * Yang menentukan set dokumen wajib: `isMicroOrSmall` dan `entityForm`
 * (USDX-605). Bentuknya sengaja sepasang field, bukan `KybDetail` utuh, supaya
 * form create — yang belum punya berkas — bisa memakai fungsi yang sama.
 */
export interface KybDocumentSetInput {
  entityForm: KybEntityForm
  isMicroOrSmall: boolean | null
}

/** Wajib untuk SETIAP badan usaha. Urutannya urutan baris halaman review. */
const KYB_BASE_DOCUMENT_SLOTS: readonly KybDocumentSlot[] = [
  'akte',
  'nib',
  'npwp',
  'ktpDireksi',
]

/** Tambahan Pasal 27 (1) huruf b angka 3, 4, 5. */
const KYB_NON_MICRO_DOCUMENT_SLOTS: readonly KybDocumentSlot[] = [
  'laporanKeuangan',
  'strukturManajemen',
  'strukturKepemilikan',
]

/**
 * Dokumen yang MENAHAN approve untuk satu berkas — POJK 8/2023 Pasal 27 ayat (1).
 *
 * Transkripsi `requiredKybDocuments` di
 * `backend/src/modules/kyb/kyb.service.ts`, dan harus tetap begitu: kalau kedua
 * sisi menjawab beda, petugas melihat baris "wajib" yang gerbangnya tidak minta —
 * atau, lebih buruk, tidak melihat baris yang gerbangnya tuntut lalu kena
 * `409 KYB_DOCUMENTS_INCOMPLETE` tanpa tahu sebabnya.
 *
 * Tiga cabang:
 *   - **mikro/kecil** → set dasar saja. Huruf b dibuka dengan "perusahaan yang
 *     TIDAK tergolong usaha mikro dan usaha kecil".
 *   - **bukan mikro/kecil, `null` termasuk** → set dasar + huruf b angka 3, 4, 5.
 *     `null` berarti belum ditanya, dan kontraknya memutuskan arah kekeliruannya:
 *     perlakukan sebagai `false`, yaitu diperiksa penuh.
 *   - **`PT_PERORANGAN`** → tidak pernah huruf b, berapa pun `isMicroOrSmall`.
 *     Perseroan perorangan diatur huruf c, yang berdiri SEJAJAR dengan huruf b.
 *
 * `skKemenkumham` tidak pernah ada di hasilnya — kondisional, dan menggerbanginya
 * membuat CV dan firma tidak akan pernah bisa VERIFIED.
 */
export function kybRequiredDocumentSlots(input: KybDocumentSetInput): KybDocumentSlot[] {
  const hurufC = input.entityForm === 'PT_PERORANGAN'
  const mikroKecil = input.isMicroOrSmall === true
  if (hurufC || mikroKecil) return [...KYB_BASE_DOCUMENT_SLOTS]
  return [...KYB_BASE_DOCUMENT_SLOTS, ...KYB_NON_MICRO_DOCUMENT_SLOTS]
}

/**
 * Slot yang DITAMPILKAN halaman review — yang wajib, ditambah `skKemenkumham`.
 *
 * Ditampilkan bukan sama dengan diwajibkan: SK Kemenkumham boleh diunggah badan
 * hukum yang memang punya, dan menyembunyikannya akan menghilangkan satu-satunya
 * tempat berkas itu bisa masuk. Yang tidak boleh ditampilkan adalah slot yang
 * pasalnya TIDAK minta untuk badan usaha ini — baris kosong yang menuntut adalah
 * cara paling langsung membuat petugas menagih dokumen yang tidak wajib.
 *
 * Hasilnya selalu dalam urutan {@link KYB_DOCUMENT_SLOT_KEYS}.
 */
export function kybApplicableDocumentSlots(input: KybDocumentSetInput): KybDocumentSlot[] {
  const required = new Set(kybRequiredDocumentSlots(input))
  return KYB_DOCUMENT_SLOT_KEYS.filter(
    (slot) => slot === 'skKemenkumham' || required.has(slot),
  )
}

/** `KARYAWAN_SWASTA` → `Karyawan swasta`. Fallback for unmapped enum values. */
export function formatEnumLabel(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Look a value up in a label map, falling back to `formatEnumLabel`, and render
 * `null` as `null` so the caller can draw its own em dash. Deliberately does NOT
 * return a dash itself: "not collected" is the caller's presentation choice, and
 * the KYC modal dims it differently from a real value.
 */
export function labelFor<T extends string>(
  value: T | null | undefined,
  labels: Record<T, string>,
): string | null {
  if (value === null || value === undefined) return null
  return labels[value] ?? formatEnumLabel(value)
}
