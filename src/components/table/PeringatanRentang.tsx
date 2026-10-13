import type { MasalahRentang } from '@/lib/wibRange'
import { pesanRentang } from '@/lib/wibRange'

// Peringatan untuk rentang tanggal yang datang dari URL dan TIDAK dipakai.
//
// Kenapa perlu komponen sendiri: aturannya (`periksaRentangWib`) hidup di
// popover DAN di halaman, dan halaman yang diam soal penolakannya tetap
// menyesatkan. Yang terlihat operator adalah tabel biasa dengan chip tanggal
// terpasang — lalu ia menyimpulkan tidak ada baris pada tanggal itu.
//
// Empat layar memakai saringan rentang (`/jejak-audit`, `/durianpay-api-calls`,
// `/mint`, `/kyc`). Putaran sebelumnya hanya memasangnya di satu, dan akibatnya
// `/durianpay-api-calls` membantah dirinya sendiri: popover menolak tanggal
// masa depan sementara halamannya tetap mengirimkannya. Satu komponen supaya
// keempatnya tidak bisa berbeda.

interface Props {
  masalah: MasalahRentang | null
  /** Ikut di `data-testid`, supaya tiap layar bisa dipatok terpisah di test. */
  layar: string
}

export default function PeringatanRentang({ masalah, layar }: Props) {
  if (!masalah) return null
  return (
    <p
      role="alert"
      data-testid={`${layar}-rentang-bermasalah`}
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-label leading-relaxed text-destructive"
    >
      Rentang tanggal di tautan ini tidak dipakai — {pesanRentang(masalah)} Yang ditampilkan di
      bawah adalah hasil TANPA saringan tanggal, bukan hasil pencarian tanggal itu.
    </p>
  )
}
