/**
 * Screening DTTOT & DPPSPM — label, skor, dan pembaca berkas daftar (USDX-588).
 *
 * Semua yang di sini murni: tidak menyentuh React, tidak menyentuh jaringan.
 * Dipisah dari layarnya karena dua hal di dalamnya adalah SALINAN dari aturan
 * yang dimiliki backend, dan salinan hanya aman kalau ia bisa dites sendiri
 * berdampingan dengan berkas aslinya:
 *
 *   - peta label enum ditulis `Record<Enum, string>`, sehingga satu nilai baru
 *     pada union tanpa labelnya di sini MENGGAGALKAN build, bukan menghasilkan
 *     sel kosong di layar;
 *   - `previewSanctionCsv` menirukan `backend/src/modules/screening/sanction-csv.ts`
 *     baris demi baris. Ia BUKAN pengganti pembaca di server — server tetap
 *     membaca ulang dan tetap yang menentukan. Ia ada supaya berkas yang cacat
 *     ketahuan SEBELUM satu versi DRAFT terlanjur dibuat: impor dipecah tiga
 *     langkah, jadi berkas yang gagal di potongan ketiga meninggalkan versi
 *     DRAFT setengah terisi yang tidak bisa dibatalkan lewat API mana pun.
 */
import type {
  SanctionEntryType,
  SanctionListSource,
  SanctionListStatus,
  SanctionListType,
  ScreeningDecisionValue,
  ScreeningOutcome,
  ScreeningResultItem,
  ScreeningSubjectType,
  ScreeningTrigger,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────────────────────

export const SANCTION_LIST_TYPE_LABELS: Record<SanctionListType, string> = {
  DTTOT: 'DTTOT — terduga teroris',
  DPPSPM: 'DPPSPM — proliferasi senjata pemusnah massal',
}

/** Versi pendek untuk sel tabel, tempat kalimat penuh di atas tidak muat. */
export const SANCTION_LIST_TYPE_SHORT: Record<SanctionListType, string> = {
  DTTOT: 'DTTOT',
  DPPSPM: 'DPPSPM',
}

export const SANCTION_LIST_SOURCE_LABELS: Record<SanctionListSource, string> = {
  PPATK: 'PPATK',
  BAPPEBTI: 'Bappebti',
  OJK: 'OJK',
  OTHER: 'Sumber lain',
}

export const SANCTION_LIST_STATUS_LABELS: Record<SanctionListStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Aktif',
  SUPERSEDED: 'Digantikan',
}

export const SANCTION_ENTRY_TYPE_LABELS: Record<SanctionEntryType, string> = {
  INDIVIDUAL: 'Perorangan',
  ENTITY: 'Badan usaha',
}

export const SCREENING_SUBJECT_TYPE_LABELS: Record<ScreeningSubjectType, string> = {
  KYC: 'Nasabah perorangan',
  KYC_UBO: 'Pemilik manfaat (UBO)',
  KYB: 'Badan usaha',
}

export const SCREENING_OUTCOME_LABELS: Record<ScreeningOutcome, string> = {
  NO_MATCH: 'Tidak cocok',
  POTENTIAL_MATCH: 'Berpotensi cocok',
  LIST_UNAVAILABLE: 'Daftar tidak tersedia',
  CLEARED: 'Dilepas',
  CONFIRMED_MATCH: 'Cocok dikonfirmasi',
}

export const SCREENING_TRIGGER_LABELS: Record<ScreeningTrigger, string> = {
  KYC_SUBMIT: 'Pengajuan KYC',
  KYB_SUBMIT: 'Pengajuan KYB',
  RESCAN: 'Pemindaian ulang',
  BACKOFFICE_DECISION: 'Keputusan back office',
}

export const SCREENING_DECISION_LABELS: Record<ScreeningDecisionValue, string> = {
  CLEARED: 'Dilepas (bukan orang yang sama)',
  CONFIRMED_MATCH: 'Cocok dikonfirmasi (tetap ditahan)',
}

/**
 * Warna badge per hasil. `CONFIRMED_MATCH` dan `POTENTIAL_MATCH` sama-sama
 * merah dan itu disengaja: keduanya berarti subjeknya SEDANG DITAHAN. Yang
 * membedakan hanya siapa yang menahannya — mesin atau petugas — dan itu sudah
 * dikatakan oleh labelnya.
 */
export const SCREENING_OUTCOME_STYLES: Record<
  ScreeningOutcome,
  { className: string; dotClass: string }
> = {
  NO_MATCH: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  POTENTIAL_MATCH: {
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
  LIST_UNAVAILABLE: {
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  CLEARED: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  CONFIRMED_MATCH: {
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

export const SANCTION_LIST_STATUS_STYLES: Record<
  SanctionListStatus,
  { className: string; dotClass: string }
> = {
  DRAFT: {
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  ACTIVE: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  SUPERSEDED: {
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground/60',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Skor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambang kecocokan yang dipakai mesin (Jaro-Winkler), disalin dari
 * `sot/api/screening.yaml § ScreeningResultItem.score`. Dipakai HANYA untuk
 * menerangkan skor di layar — bukan untuk memutuskan apa pun ulang di sini.
 */
/**
 * Dua daftar yang POJK 8/2023 Pasal 53 wajibkan dicocokkan, bukan pilihan produk.
 * Sama dengan `REQUIRED_LIST_TYPES` di `backend/src/modules/screening/
 * screening.service.ts`, yang memancarkan SATU baris hasil per jenis daftar pada
 * tiap pemeriksaan.
 */
export const REQUIRED_SANCTION_LIST_TYPES = ['DTTOT', 'DPPSPM'] as const

/** Hasil TERBARU yang benar-benar memakai satu jenis daftar. */
export interface SubjectListCoverage {
  listType: SanctionListType
  /** `null` = belum pernah ada satu pun pemeriksaan yang benar-benar membaca daftar ini. */
  latest: ScreeningResultItem | null
}

/** Keadaan screening SATU subjek, sebagaimana dibaca halaman review KYC/KYB. */
export interface SubjectScreeningSummary {
  /** Satu baris per jenis daftar WAJIB, urutannya tetap. */
  coverage: SubjectListCoverage[]
  /** Jenis daftar wajib yang belum pernah sekali pun benar-benar dicek. */
  unchecked: SanctionListType[]
  /** Banyaknya pemeriksaan yang tercatat gagal membaca daftarnya. */
  unavailableCount: number
  /** Temuan yang MASIH MENAHAN subjek — inilah yang membuat approve dijawab 409. */
  holding: ScreeningResultItem[]
  /** Belum ada satu baris pun: subjek ini tidak pernah diperiksa. */
  neverScreened: boolean
}

/**
 * USDX-610 — ringkas hasil screening satu subjek untuk halaman review.
 *
 * ── KENAPA "DAFTAR MANA YANG BELUM DICEK" DIHITUNG TERBALIK ──────────────────
 *
 * Baris `LIST_UNAVAILABLE` TIDAK membawa jenis daftarnya, dan itu bukan
 * kelalaian yang bisa ditambal di sini: CHECK `screening_results_row_shape`
 * mewajibkan `list_id` NULL untuk hasil itu, dan `listType` pada response
 * berasal dari join ke `sanction_lists`. Jadi barisnya memang tidak bisa
 * ditanya "daftar mana yang tidak terbaca".
 *
 * Yang BISA dijawab dengan pasti adalah kebalikannya: jenis daftar wajib mana
 * yang tidak punya SATU PUN hasil sungguhan untuk subjek ini. Itu fakta yang
 * dibaca langsung dari barisnya, bukan tebakan — dan itu juga pertanyaan yang
 * sebenarnya dijawab pemeriksa OJK: "berkas ini pernah dicocokkan dengan DPPSPM
 * atau belum".
 *
 * Konsekuensinya dicatat supaya tidak ditemukan sebagai kejutan: daftar yang
 * PERNAH berhasil dicek lalu gagal dibaca pada pemeriksaan berikutnya tetap
 * dihitung "tercek" (bukti lamanya sah dan menyebutnya belum-tercek akan
 * menghapusnya), sementara kegagalannya tetap dilaporkan lewat
 * `unavailableCount`. Keduanya benar dan keduanya ditampilkan.
 *
 * `holding` meniru `assertNoneHeld` di server: `POTENTIAL_MATCH` yang keputusannya
 * BUKAN `CLEARED` masih menahan — termasuk yang sudah diputus `CONFIRMED_MATCH`,
 * karena keputusan itu MENEGASKAN penahanan, bukan melepaskannya.
 */
export function summariseSubjectScreening(
  rows: readonly ScreeningResultItem[],
): SubjectScreeningSummary {
  // Server sudah mengurutkan `created_at DESC`, tapi ringkasan ini tidak boleh
  // bergantung pada urutan yang tidak dijanjikan parameter apa pun.
  const newestFirst = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const coverage: SubjectListCoverage[] = REQUIRED_SANCTION_LIST_TYPES.map((listType) => ({
    listType,
    latest: newestFirst.find((r) => r.listType === listType) ?? null,
  }))

  return {
    coverage,
    unchecked: coverage.filter((c) => c.latest === null).map((c) => c.listType),
    unavailableCount: newestFirst.filter((r) => r.outcome === 'LIST_UNAVAILABLE').length,
    holding: newestFirst.filter(
      (r) => r.outcome === 'POTENTIAL_MATCH' && r.decision?.outcome !== 'CLEARED',
    ),
    neverScreened: newestFirst.length === 0,
  }
}

export const SCREENING_MATCH_THRESHOLD = 0.85

/**
 * `0.9231` → `92.3%`. `null` dikembalikan sebagai `null`, bukan `"0%"`: skor
 * kosong hanya terjadi pada `LIST_UNAVAILABLE`, dan nol persen akan terbaca
 * sebagai "sudah dibandingkan dan sangat berbeda" — kebalikan dari artinya.
 */
export function formatScore(score: number | null | undefined): string | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null
  return `${(score * 100).toFixed(1)}%`
}

/**
 * Seberapa jauh skor di atas ambang, 0..1, untuk panjang bilah di layar.
 *
 * Diregangkan dari ambang (0.85) ke 1 dan bukan dari 0: seluruh antrean berada
 * di atas ambang, jadi bilah dari nol membuat 0.86 dan 0.99 terlihat nyaris
 * sama panjang — persis perbedaan yang harus dilihat petugas lebih dulu.
 */
export function scoreBarFraction(score: number | null | undefined): number {
  if (score === null || score === undefined || !Number.isFinite(score)) return 0
  if (score <= SCREENING_MATCH_THRESHOLD) return 0.06
  const span = 1 - SCREENING_MATCH_THRESHOLD
  return Math.min(1, Math.max(0.06, (score - SCREENING_MATCH_THRESHOLD) / span))
}

// ─────────────────────────────────────────────────────────────────────────────
// Pesan kegagalan server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tiap `code` bisnis yang disebut `sot/api/screening.yaml` dipetakan ke satu
 * kalimat yang menyebut SEBABNYA. Petugas yang sedang memegang berkas daftar
 * sanksi perlu tahu apakah masalahnya ada pada berkasnya atau pada kami —
 * `400 Bad Request` tidak menjawab keduanya.
 */
export const SCREENING_ERROR_MESSAGES: Record<string, string> = {
  SANCTION_LIST_NOT_DRAFT:
    'Versi daftar ini sudah tidak berstatus DRAFT, jadi entrinya tidak bisa ditambah atau diaktifkan lagi. Buat versi baru untuk berkas yang lebih baru.',
  SANCTION_CSV_INVALID:
    'Server menolak isi berkas: baris headernya tidak dikenali atau ada baris yang tidak terbaca.',
  SANCTION_LIST_EMPTY:
    'Versi ini belum berisi satu entri pun. Mengaktifkannya berarti memeriksa nasabah terhadap daftar kosong lalu mencatatnya sebagai "lolos".',
  SANCTION_LIST_UNAVAILABLE:
    'Belum ada satu pun versi daftar berstatus AKTIF, jadi tidak ada dasar untuk memeriksa. Aktifkan sebuah versi lebih dulu.',
  SCREENING_RESULT_NOT_ACTIONABLE:
    'Temuan ini bukan temuan yang menunggu keputusan — mungkin hasilnya bukan "berpotensi cocok", atau sudah diputuskan orang lain. Muat ulang antrean untuk melihat keadaan terkininya.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Pembaca berkas daftar (CSV)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batas panjang satu potongan `csv`, disalin dari `ImportSanctionEntriesDto`
 * (`@MaxLength(90_000)`). Angkanya sendiri lahir dari batas body JSON Express
 * 100 kB di backend, dengan ruang untuk selubung JSON-nya.
 */
export const SANCTION_CSV_CHUNK_MAX = 90_000

/** Satu-satunya kolom yang WAJIB ada. Sama dengan `REQUIRED_COLUMN` di backend. */
export const SANCTION_CSV_REQUIRED_COLUMN = 'full_name'

/**
 * Kolom yang backend baca. Kolom di luar daftar ini DIBIARKAN, tidak
 * menggagalkan impor — publikasi berikutnya lebih sering menambah kolom
 * daripada mengganti kolom, dan menolak seluruh berkas karena satu kolom baru
 * berarti daftar sanksi gagal masuk justru pada hari ia diperbarui.
 */
export const SANCTION_CSV_KNOWN_COLUMNS = [
  'full_name',
  'entry_type',
  'reference_code',
  'aliases',
  'date_of_birth',
  'place_of_birth',
  'nationality',
  'address',
  'notes',
] as const

/**
 * Satu baris CSV beserta TEKS ASLINYA.
 *
 * Teks aslinya ikut dibawa karena potongan yang dikirim ke server harus berupa
 * CSV lagi. Menyusun ulang baris dari nilai-nilai yang sudah diurai berarti
 * menulis penulis CSV kedua yang harus menirukan pengutipan server dengan tepat;
 * mengirim balik potongan teks yang persis sama tidak punya cara untuk salah.
 */
interface RawCsvRow {
  cells: string[]
  text: string
}

/**
 * Pemisah baris/kolom yang sadar tanda kutip, mengikuti RFC 4180 secukupnya —
 * cermin `splitRows` di backend: pemisah koma, nilai boleh dikutip ganda, kutip
 * di dalam nilai terkutip ditulis dobel, akhir baris CRLF maupun LF.
 *
 * Baris baru DI DALAM nilai terkutip bukan akhir baris. Ini bukan kehalusan
 * teoretis: kolom `address` daftar sanksi memuat alamat berbaris ganda, dan
 * pemotong yang memisah per `\n` akan membelah satu entri jadi dua potongan
 * yang keduanya rusak.
 */
function splitCsvRows(text: string): RawCsvRow[] {
  // BOM dari Excel menempel di nama kolom pertama dan membuat `full_name` tak terlihat.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: RawCsvRow[] = []
  let cells: string[] = []
  let field = ''
  let inQuotes = false
  let rowStart = 0

  const pushRow = (endExclusive: number, nextStart: number) => {
    cells.push(field)
    rows.push({ cells, text: input.slice(rowStart, endExclusive) })
    cells = []
    field = ''
    rowStart = nextStart
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(field)
      field = ''
    } else if (char === '\n') {
      // `\r\n`: buang CR dari teks baris, bukan dari nilainya.
      const end = i > 0 && input[i - 1] === '\r' ? i - 1 : i
      pushRow(end, i + 1)
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || cells.length > 0) {
    pushRow(input.length, input.length)
  }

  return rows
}

function isBlankRow(row: RawCsvRow): boolean {
  return row.cells.every((cell) => cell.trim().length === 0)
}

function cellAt(row: RawCsvRow, index: number | undefined): string | null {
  if (index === undefined) return null
  const value = row.cells[index]?.trim() ?? ''
  return value.length === 0 ? null : value
}

export interface SanctionCsvPreview {
  /** Nama kolom sebagaimana terbaca (sudah di-lowercase, seperti backend). */
  columns: string[]
  /** Kolom yang terbaca tapi tidak dipakai backend — ditampilkan, bukan ditolak. */
  ignoredColumns: string[]
  /** Jumlah baris entri (tanpa header, tanpa baris kosong). */
  entryCount: number
  /** Berapa entri bertanda `ENTITY`; sisanya `INDIVIDUAL`. */
  entityCount: number
  /** Nama pada beberapa baris pertama — bukti bagi petugas bahwa kolomnya benar. */
  sampleNames: string[]
}

export type SanctionCsvParseResult =
  | { ok: true; preview: SanctionCsvPreview }
  | { ok: false; error: string }

/**
 * Baca berkas daftar SELURUHNYA sebelum apa pun dikirim.
 *
 * Nomor baris dihitung seperti Excel menghitungnya (header = baris 1), sama
 * dengan pesan `SanctionCsvError` di backend, supaya petugas memperbaikinya di
 * tempat ia melihat berkasnya.
 *
 * Aturannya diambil dari backend dan tidak dilonggarkan di sini: `full_name`
 * wajib ada di header, tiap baris wajib punya nama, dan `entry_type` — kalau
 * diisi — hanya boleh `INDIVIDUAL` atau `ENTITY`.
 */
export function previewSanctionCsv(text: string): SanctionCsvParseResult {
  const rows = splitCsvRows(text).filter((row) => !isBlankRow(row))
  if (rows.length === 0) {
    return { ok: false, error: 'Berkas daftar kosong — tidak ada satu baris pun yang bisa dibaca.' }
  }

  const header = rows[0]!.cells.map((name) => name.trim().toLowerCase())
  const columnIndex = new Map<string, number>()
  header.forEach((name, index) => {
    if (!columnIndex.has(name)) columnIndex.set(name, index)
  })

  if (!columnIndex.has(SANCTION_CSV_REQUIRED_COLUMN)) {
    return {
      ok: false,
      error: `Kolom "${SANCTION_CSV_REQUIRED_COLUMN}" tidak ditemukan di baris header. Kolom yang terbaca: ${header.join(', ')}.`,
    }
  }
  if (rows.length === 1) {
    return { ok: false, error: 'Berkas daftar hanya berisi header, tidak ada entri sama sekali.' }
  }

  const known = new Set<string>(SANCTION_CSV_KNOWN_COLUMNS)
  const ignoredColumns = header.filter((name) => name.length > 0 && !known.has(name))

  const sampleNames: string[] = []
  let entityCount = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!
    // Baris seperti yang dilihat petugas di Excel: header = baris 1.
    const lineNumber = r + 1

    const fullName = cellAt(row, columnIndex.get(SANCTION_CSV_REQUIRED_COLUMN))
    if (fullName === null) {
      return {
        ok: false,
        error: `Nama lengkap kosong pada baris ${lineNumber}. Entri daftar sanksi tanpa nama tidak bisa dicocokkan dengan siapa pun.`,
      }
    }

    const rawType = cellAt(row, columnIndex.get('entry_type'))
    const entryType = rawType === null ? 'INDIVIDUAL' : rawType.toUpperCase()
    if (entryType !== 'INDIVIDUAL' && entryType !== 'ENTITY') {
      return {
        ok: false,
        error: `Nilai entry_type "${rawType}" pada baris ${lineNumber} tidak dikenal — isi INDIVIDUAL atau ENTITY.`,
      }
    }
    if (entryType === 'ENTITY') entityCount++

    if (sampleNames.length < 5) sampleNames.push(fullName)
  }

  return {
    ok: true,
    preview: {
      columns: header,
      ignoredColumns,
      entryCount: rows.length - 1,
      entityCount,
      sampleNames,
    },
  }
}

/**
 * Pecah berkas jadi potongan-potongan CSV yang berdiri sendiri, masing-masing
 * membawa baris header yang SAMA.
 *
 * Kenapa header diulang: server tidak mengingat keadaan apa pun di antara
 * panggilan (`ImportSanctionEntriesDto`), jadi potongan tanpa header akan
 * dibaca sebagai berkas yang baris pertamanya — sebuah entri sungguhan —
 * dianggap nama kolom. Entri itu akan hilang diam-diam dari daftar sanksi.
 *
 * Pemotongan selalu jatuh di batas BARIS, tidak pernah di tengah nilai
 * terkutip, karena yang dipotong adalah hasil `splitCsvRows`, bukan teksnya.
 *
 * Satu baris yang sendirian sudah melampaui batas tetap dikirim sebagai satu
 * potongan: memangkasnya diam-diam akan merusak entri, dan penolakan server
 * adalah kabar yang benar untuk baris seperti itu.
 */
export function chunkSanctionCsv(
  text: string,
  maxChars: number = SANCTION_CSV_CHUNK_MAX,
): string[] {
  const rows = splitCsvRows(text).filter((row) => !isBlankRow(row))
  if (rows.length < 2) return []

  const headerText = rows[0]!.text
  const chunks: string[] = []
  let current: string[] = []
  let currentLength = headerText.length

  for (let r = 1; r < rows.length; r++) {
    const rowText = rows[r]!.text
    // +1 untuk `\n` yang menyambung baris ini ke baris sebelumnya.
    const added = rowText.length + 1
    if (current.length > 0 && currentLength + added > maxChars) {
      chunks.push([headerText, ...current].join('\n'))
      current = []
      currentLength = headerText.length
    }
    current.push(rowText)
    currentLength += added
  }

  if (current.length > 0) chunks.push([headerText, ...current].join('\n'))
  return chunks
}
