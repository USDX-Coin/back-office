// SATU KONVENSI ANGKA DI SELURUH BACK OFFICE: titik untuk ribuan, koma untuk
// desimal. Nominalnya boleh dolar, rupiah, USDX, atau persen — pembacanya satu
// orang yang sama, dan `1,234.00` di sebelah `Rp 1.234,00` membuatnya berhenti
// untuk menebak mana yang ribuan.
//
// Glif `$` DIPERTAHANKAN (bukan `US$` yang dihasilkan `Intl` untuk `id-ID`):
// yang salah baca selama ini pemisahnya, bukan lambang mata uangnya, dan
// mengganti lambang hanya menambah perubahan yang tidak menjawab apa pun.
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  const negatif = amount < 0
  return `${negatif ? '-' : ''}$${formatDecimalId(Math.abs(amount).toFixed(2))}`
}

// USDX-46 — preview helpers for the currency-aware amount input.
//
// sot/conventions.md § Decimals:
// - USDX uses 6 decimals (like USDC/USDT) — display up to 6.
// - IDR uses 2 decimals + locale format `Rp 16.250.000,00`.

const USDX_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
})

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatUsdxAmount(usdx: number): string {
  if (!Number.isFinite(usdx)) return '—'
  return `${USDX_FORMATTER.format(usdx)} USDX`
}

export function formatIdrAmount(idr: number): string {
  if (!Number.isFinite(idr)) return '—'
  return `Rp ${IDR_FORMATTER.format(idr)}`
}

// ─── Ejaan angka Indonesia untuk nilai yang datang sebagai STRING ───────────
//
// Kenapa string, bukan `Number`: nilai uang dan pasokan token di repo ini
// SELALU string desimal di atas kolom `numeric`. `totalSupply` bisa melewati
// 2^53, dan `Number("12450000000000000000.50")` sudah kehilangan satuan
// terkecilnya sebelum sempat diformat. Fungsi di bawah memotong string dan
// menyisipkan pemisah — tidak ada aritmetika sama sekali, jadi tidak ada digit
// yang bisa hilang. Ini PENYAJIAN, bukan perhitungan.
//
// Ejaannya Indonesia: TITIK untuk ribuan, KOMA untuk desimal. Angka gaya
// Inggris di layar berbahasa Indonesia bukan sekadar tidak rapi —
// `12,450,000.00` bisa dibaca "dua belas koma empat", yaitu enam kali lipat
// salah pada layar yang pertama dibuka operator tiap pagi.

/** Kelompokkan digit ribuan dengan titik. String masuk, string keluar. */
function kelompokkanRibuan(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * `"12450000.5"` → `"12.450.000,50"`. `fractionDigits: 0` membuang desimalnya
 * (`"16250.00"` → `"16.250"`). Nilai negatif mempertahankan tandanya.
 */
export function formatDecimalId(value: string, fractionDigits = 2): string {
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [whole = '0', fraction = ''] = abs.split('.')
  const sign = negative ? '-' : ''
  const grouped = kelompokkanRibuan(whole)
  if (fractionDigits <= 0) return `${sign}${grouped}`
  const trimmed = (fraction + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
  return `${sign}${grouped},${trimmed}`
}

/**
 * Kurs sebagai rupiah bulat: `"16250.00"` → `"Rp 16.250"`.
 *
 * Spasi setelah `Rp` mengikuti `formatIdrAmount` / `formatIdrExact`, yaitu
 * ejaan yang dipakai SELURUH layar uang lain di back office ini.
 */
export function formatIdrRate(value: string): string {
  return `Rp ${formatDecimalId(value, 0)}`
}

/**
 * Nominal USDX sebuah BARIS DAFTAR (`requests.amount`, `orders.amount`,
 * `manual-sync.amount`) untuk ditampilkan — dua angka di belakang koma.
 *
 * Ada supaya empat halaman berhenti menulis aturan yang sama masing-masing:
 * mint, burn, transaksi nasabah, dan perbaiki-status-nyangkut sebelumnya
 * memformat sendiri dengan `'en-US'`, jadi `1,234,567.89 USDX` berdiri di
 * sebelah `Rp 16.250.000,00` pada satu baris yang sama.
 *
 * CATATAN SADAR — `Number()` di sini SUDAH ADA sebelumnya dan TIDAK diubah
 * bersama perapian ejaan ini. Yang diminta perubahan PENYAJIAN, dan mengganti
 * jalur numeriknya juga akan mengubah pembulatan (`Number('1.005')` dibulatkan,
 * pemotongan string tidak) — perubahan perilaku yang tidak diminta siapa pun di
 * layar uang. Nilai di atas 2^53 karena itu masih kehilangan presisi di sini,
 * persis seperti sebelumnya; kalau itu hendak dibereskan, satu-satunya tempat
 * yang perlu disentuh sekarang ini, bukan empat halaman.
 */
export function formatUsdxListAmount(nilai: string): string {
  const n = Number(nilai)
  if (!Number.isFinite(n)) return nilai
  return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Generic middle-truncation for a hex string (address / tx hash):
// `0x1234…abcd`. Returns the value unchanged when it is already short enough.
// USDX-27: used by <TruncatedHash> for the responsive (mobile vs desktop)
// address/hash display.
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (!value || value.length <= head + tail) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

// Truncate an 0x hash for display: `0x3d84b05e…d4587f`. Returns the hash
// unchanged when it's already short enough.
export function shortHash(hash: string, head = 10, tail = 6): string {
  return truncateMiddle(hash, head, tail)
}

// USDX-84 / USDX-87: short form of a request UUID for compact display in
// banners + the Manual Sync list. AC expects
// `019e1aa8-9c7c-7fcd-6abc-deadbeef0001` → `019e1aa8…f0001` (first UUID
// segment + last 5 chars). Delegates to truncateMiddle.
export function shortRequestId(id: string): string {
  return truncateMiddle(id, 8, 5)
}

export function formatDate(dateString: string): string {
  // `id-ID`, bukan `en-US`: tanggalnya terbaca "25 Mar 2026", bukan
  // "Mar 25, 2026". Urutan hari-bulan-tahun itu yang dibaca operator di
  // dokumen, mutasi bank, dan KTP.
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatShortDate(dateString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))
}

const SHORT_MONTH_DAY = new Intl.DateTimeFormat('id-ID', { month: 'short', day: 'numeric' })
const SHORT_MONTH_DAY_YEAR = new Intl.DateTimeFormat('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })

// String desimal kurs ("16250.00") → "16.250,00 IDR/USD".
// Nilai yang tidak terbaca dikembalikan APA ADANYA, supaya jawaban backend yang
// tak terduga tidak tersembunyi di balik artefak koersi.
export function formatRate(rate: string): string {
  const n = Number(rate)
  if (!Number.isFinite(n)) return rate
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} IDR/USD`
}

// Format spread as a literal percentage. SoT example "0.5" means 0.5%
// (sot/phase-1.md § Rate Configuration: "spread_pct ... markup % di atas rate").
// See docs/notes/usdx-20-decisions.md for the literal-percent rationale.
export function formatSpreadPct(pct: string): string {
  const n = Number(pct)
  if (!Number.isFinite(n)) return `${pct}%`
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}%`
}

export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const then = new Date(dateString)
  const deltaMs = now.getTime() - then.getTime()
  if (deltaMs < 0) return 'baru saja'

  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const dayDelta = Math.floor((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000)

  // Same calendar day → hour-granular
  if (dayDelta === 0) {
    const hours = Math.floor(minutes / 60)
    return `${hours} jam lalu`
  }
  if (dayDelta === 1) return 'kemarin'
  if (dayDelta < 7) return `${dayDelta} hr lalu`

  if (now.getFullYear() === then.getFullYear()) {
    return SHORT_MONTH_DAY.format(then)
  }
  return SHORT_MONTH_DAY_YEAR.format(then)
}

// ─── Rekening BNI (USDX-631, sot/bni-integration.md § 16.4) ─────────────────

// A bank timestamp is a digit string in WIB with NO zone marker:
// `yyyyMMddHHmmss` (statement `postDate`), `yyyyMMddHHmm` (InquiryBalance
// `date`, `gaps[].afterAt` of a balance observation) or `yyyyMMdd`. It is
// re-punctuated as-is — never parsed through `Date`, which would shift it into
// the browser's zone. Anything else (null, `MALFORMED`, stray spaces the
// service could not repair) renders as "—", never `Invalid Date`.
const BNI_STAMP = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/

export function formatBniPostDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const m = BNI_STAMP.exec(raw)
  if (!m) return '—'
  const [, y, mo, d, h, mi, s] = m
  const date = `${y}-${mo}-${d}`
  if (!h || !mi) return date
  return s ? `${date} ${h}:${mi}:${s}` : `${date} ${h}:${mi}`
}

// Bank nominal (string decimal, no sign) in the account's own currency:
// `IDR` → `Rp 1.234,00`, `USD` → `$1,234.00`; any other code falls back to a
// plain number followed by the code so nothing is silently mislabelled.
// Null / unparsable (`MALFORMED`) → "—".
export function formatBankAmount(
  amount: string | null | undefined,
  currency: string | null | undefined
): string {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  if (currency === 'IDR') return formatIdrAmount(n)
  if (currency === 'USD') return formatAmount(n)
  const plain = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  return currency ? `${plain} ${currency}` : plain
}

// Our own pull time (`pulledAt`, UTC ISO 8601 from the backend) rendered in
// WIB regardless of where the operator sits — the bank stamps next to it are
// WIB too, so the two must not disagree by the operator's zone.
const WIB_DATETIME_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * Jam dinding WIB saja: `HH:MM WIB` (USDX-639).
 *
 * Dipakai banner mode uji, yang harus menjawab satu pertanyaan dalam satu
 * kalimat — "sampai jam berapa ini menyala" — dan jendelanya tidak pernah
 * lebih dari 24 jam, jadi tanggalnya hanya menambah kata tanpa menambah
 * jawaban. Kartu Mode Mint tetap memakai `formatWibDateTime` yang lengkap.
 */
export function formatWibClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WIB_DATETIME_FMT.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${hour}:${part('minute')} WIB`
}

export function formatWibDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WIB_DATETIME_FMT.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${part('year')}-${part('month')}-${part('day')} ${hour}:${part('minute')}:${part('second')} WIB`
}

// ─── Salinan mutasi BNI (USDX-692, sot/bni-integration.md § 16.8.8) ─────────

/**
 * `DD/MM/YYYY HH:mm WIB` — the "direkam s/d" stamp of the statement copy.
 * Minute precision on purpose: the recorder ticks every 10 minutes, so seconds
 * add digits without adding an answer. Null / unparsable → `null` (NOT "—"):
 * the caller has a sentence of its own for "never recorded".
 */
export function formatWibDayMinute(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WIB_DATETIME_FMT.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${part('day')}/${part('month')}/${part('year')} ${hour}:${part('minute')} WIB`
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A WIB calendar day `YYYY-MM-DD` → `DD/MM/YYYY`, re-punctuated WITHOUT going
 * through `Date` (it is already a WIB day; parsing would shift it into the
 * browser's zone). Anything else → `null`, never "Invalid Date".
 */
export function formatIsoDayDmy(day: string | null | undefined): string | null {
  if (!day) return null
  const m = ISO_DAY.exec(day)
  if (!m) return null
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}

const ID_SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Tanggal kalender `YYYY-MM-DD` (mis. tanggal lahir) → `25 Jan 1994`, ejaan
 * yang sama dengan kolom tanggal lain. Tanpa `Date`: tanggal tanpa jam yang
 * di-parse akan bergeser ke zona peramban. Bentuk lain dikembalikan APA ADANYA.
 */
export function formatIsoDayLong(day: string): string {
  const m = ISO_DAY.exec(day)
  if (!m) return day
  const [, y, mo, d] = m
  const month = ID_SHORT_MONTH[Number(mo) - 1]
  return month ? `${Number(d)} ${month} ${y}` : day
}

/**
 * Kode negara ISO alpha-2 (`ID`) → `Indonesia (ID)`. Kodenya tetap ditulis
 * (itu yang tersimpan dan yang dicocokkan dengan sistem lain); kode yang tidak
 * dikenal peramban dikembalikan apa adanya.
 */
export function formatCountryCode(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return code
  let name: string | undefined
  try {
    name = new Intl.DisplayNames(['id'], { type: 'region' }).of(c)
  } catch {
    name = undefined
  }
  return name && name !== c ? `${name} (${c})` : code
}

const BNI_ACCOUNT_TYPE_LABEL: Record<string, string> = { G: 'Giro', S: 'Tabungan', T: 'Deposito' }

/**
 * Kode jenis rekening dari BNI (`G`/`S`/`T`) → kata yang dibaca operator.
 * Audit 8 Okt 2026: kartu saldo menampilkan "PT … · G · IDR". Kode yang tidak
 * dikenal dikembalikan apa adanya — ditebak artinya lebih buruk daripada mentah.
 */
export function bniAccountTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return BNI_ACCOUNT_TYPE_LABEL[code.trim().toUpperCase()] ?? code
}

/** Mode kurs dari server (`MANUAL` / `DYNAMIC`) → kata yang dibaca operator. */
export function rateModeLabel(mode: string): string {
  if (mode === 'MANUAL') return 'Manual'
  if (mode === 'DYNAMIC') return 'Otomatis (kurs pasar)'
  return mode
}
