// Menstempel tanggal yang dipilih operator sebagai instan WIB (+07:00).
//
// Kenapa perlu sama sekali: isian `<input type="date">` menghasilkan tanggal
// telanjang (`2026-09-19`). Dikirim apa adanya, backend membacanya sebagai UTC —
// yaitu **07:00 WIB** — dan tujuh jam kejadian pagi hilang tanpa ada yang memberi
// tahu. Itu kelas kegagalan yang paling buruk di layar bukti kepatuhan: hasilnya
// tampak seperti pencarian yang berhasil.
//
// Dipakai BERSAMA oleh Log Panggilan DurianPay dan Jejak Audit. Keduanya bicara
// ke DTO backend yang bentuknya sengaja disamakan (`from`/`to`, `@IsISO8601()`,
// batas INKLUSIF di kedua ujung), dan komentar timbal-balik ditulis di kedua DTO
// itu. Jadi aturannya tinggal di satu tempat di sini juga — menyalinnya ke layar
// kedua berarti dua tempat yang bisa bergeser sendiri-sendiri.
//
// `src/lib/durianpayApiCalls.ts` me-re-export keduanya supaya pemanggil lamanya
// tidak berubah.

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Awal hari itu di WIB. Bentuk yang bukan `YYYY-MM-DD` dikembalikan `null` —
 * pemanggil TIDAK mengirimnya, alih-alih menebak maksudnya. Nilai URL basi atau
 * salah ketik akan dijawab 400 oleh `@IsISO8601()`, dan tabel yang menjawab
 * galat karena tautan lama terbaca sebagai layar rusak.
 */
export function wibDayStartIso(day: string): string | null {
  return CALENDAR_DAY.test(day) ? `${day}T00:00:00+07:00` : null
}

/**
 * Batas atas INKLUSIF — backend membandingkan `lte` di kedua endpoint, jadi
 * sampai milidetik terakhir hari itu. Memakai `T00:00:00` hari berikutnya akan
 * memasukkan satu milidetik yang bukan milik rentangnya.
 */
export function wibDayEndIso(day: string): string | null {
  return CALENDAR_DAY.test(day) ? `${day}T23:59:59.999+07:00` : null
}

// ─── Aturan rentang untuk saringan tabel ────────────────────────────────────
//
// `lib/dateRange.ts` sudah memegang aturan rentang WAJIB-DUA-SISI (laporan, mutasi
// BNI): di sana kedua tanggal harus terisi. Saringan tabel berbeda — satu sisi saja
// sah ("sejak 12 September", "sampai 12 September"). Jadi bentuknya di sini, bukan
// di sana, dan keduanya tidak saling menimpa.
//
// Dipakai DUA jalur, dan itu intinya:
//   1. popover saringan — mematikan tombol Terapkan
//   2. halaman — menolak nilai yang datang dari URL
//
// Jalur kedua yang dulu bocor. Gerbang yang cuma hidup di popover tidak pernah
// dilewati tautan lama, bookmark, atau hasil salin-tempel — dan justru lewat
// situlah pemeriksa membuka layar bukti kepatuhan.

export type MasalahRentang = 'BENTUK' | 'TANGGAL_MUSTAHIL' | 'URUTAN' | 'MASA_DEPAN'

export interface VonisRentang {
  sah: boolean
  masalah: MasalahRentang | null
}

/** Hari ini di WIB, `YYYY-MM-DD`. Jam peramban bisa di zona lain. */
export function hariIniWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const BENTUK_TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/**
 * Apakah tanggalnya benar-benar ada di kalender?
 *
 * `2026-02-31` lolos regex dan lolos `Date.parse`, tapi `new Date()` di server
 * membacanya sebagai 3 Maret. Chip di layar bilang Februari, server mencari
 * Maret — hasil pencarian yang salah tanpa satu pun tanda.
 */
function adaDiKalender(hari: string): boolean {
  const [y, m, d] = hari.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * Vonis atas sepasang tanggal saringan. Keduanya OPSIONAL dan berdiri sendiri;
 * kosong dua-duanya berarti tidak ada saringan, dan itu sah.
 */
export function periksaRentangWib(mulai: string, akhir: string): VonisRentang {
  const hariIni = hariIniWib()
  for (const nilai of [mulai, akhir]) {
    if (!nilai) continue
    if (!BENTUK_TANGGAL.test(nilai)) return { sah: false, masalah: 'BENTUK' }
    if (!adaDiKalender(nilai)) return { sah: false, masalah: 'TANGGAL_MUSTAHIL' }
    // Jejak audit dan log panggilan mencatat yang SUDAH terjadi. Rentang yang
    // berakhir di masa depan hanya bisa menjawab nol baris untuk bagian itu —
    // dan nol baris terbaca "tidak ada jejaknya".
    if (nilai > hariIni) return { sah: false, masalah: 'MASA_DEPAN' }
  }
  if (mulai && akhir && mulai > akhir) return { sah: false, masalah: 'URUTAN' }
  return { sah: true, masalah: null }
}

/** Kalimat untuk operator. Satu tempat, supaya popover dan halaman tidak berbeda. */
export function pesanRentang(masalah: MasalahRentang): string {
  switch (masalah) {
    case 'BENTUK':
      return 'Tanggal harus berbentuk YYYY-MM-DD.'
    case 'TANGGAL_MUSTAHIL':
      return 'Tanggal itu tidak ada di kalender.'
    case 'URUTAN':
      return 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.'
    case 'MASA_DEPAN':
      return 'Tanggal tidak boleh melewati hari ini (WIB).'
  }
}

/**
 * Adakah rentang tanggal yang TIDAK SAH di antara seluruh saringan?
 *
 * Tinggal di modul ini, bukan di `FilterPopover`, karena dua alasan yang
 * kebetulan sejalan: berkas komponen yang mengekspor fungsi non-komponen
 * mematikan React Fast Refresh (dan memerahkan lint), dan aturannya memang
 * dipakai jalur kedua — halaman yang membaca nilai dari URL.
 */
export function adaRentangTidakSah(
  defs: readonly { kind: string; startKey?: string; endKey?: string }[],
  values: Record<string, string>
): boolean {
  return defs.some((def) => {
    if (def.kind !== 'dateRange' || !def.startKey || !def.endKey) return false
    return !periksaRentangWib(values[def.startKey] ?? '', values[def.endKey] ?? '').sah
  })
}
