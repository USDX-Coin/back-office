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
