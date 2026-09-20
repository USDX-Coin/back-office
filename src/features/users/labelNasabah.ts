import { truncateMiddle } from '@/lib/format'
import type { PhaseOneUser } from '@/lib/types'

/**
 * Nama yang dipakai menyebut nasabah di kalimat yang dibaca operator.
 *
 * `users.name` BOLEH null (`sot/api/users.yaml § User`): nasabah yang daftar
 * sendiri belum punya nama sampai KYC pertamanya masuk. Dialog hapus dulu
 * mencetak `user.name` mentah, jadi untuk nasabah itu kalimatnya berbunyi
 * "Akun null dihapus dari back-office" — pada satu-satunya layar yang tugasnya
 * memastikan operator menghapus orang yang benar.
 *
 * Rantainya TIGA tingkat, bukan dua, supaya "null" tidak sekadar pindah tempat:
 * nama → email → potongan id. `email` bertipe non-null di kontraknya, tapi tipe
 * `string` tidak melarang string kosong, dan `id` selalu ada.
 *
 * Penanda `(partner customer)` (`lib/pii.ts`) sengaja TIDAK diperiksa di sini.
 * Ia hanya dipasang pada baris ORDER yang tidak punya baris `users` sama sekali
 * (`mocks/data.ts`, dipakai `TransactionsListPage`), sedangkan fungsi ini selalu
 * menerima baris `users` sungguhan dari `GET /api/v1/users`. Menambah cabang
 * untuk keadaan yang tidak bisa terjadi hanya menambah cabang yang tidak pernah
 * dijalankan satu tes pun.
 */
export function labelNasabah(user: PhaseOneUser): string {
  const nama = user.name?.trim()
  if (nama) return nama
  const email = user.email?.trim()
  if (email) return email
  return `nasabah ${truncateMiddle(user.id, 8, 4)}`
}
