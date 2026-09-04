/**
 * Siapa boleh melihat PII nasabah yang sudah ter-decrypt di back office, dan apa
 * yang dirender kalau ia tidak boleh.
 *
 * ── ATURANNYA: YANG BOLEH MEMUTUSKAN, BOLEH MELIHAT (USDX-610) ───────────────
 *
 * `canReviewCustomerPii` → **STAFF / MANAGER / ADMIN**, DEVELOPER tertutup,
 * fail-closed. Ketiga role itu persis yang menekan Approve/Reject:
 *
 *   `kyc-backoffice.controller.ts`  approve/reject → STAFF, MANAGER, ADMIN
 *   `kyb.controller.ts`             approve/reject → STAFF, MANAGER, ADMIN
 *   `screening.controller.ts`       results/:id/decide → STAFF, MANAGER, ADMIN
 *
 * dan DEVELOPER menerima 403 di ketiganya, jadi tidak ada alur kerjanya yang
 * membutuhkan NIK, NPWP, nama gadis ibu kandung, atau alamat tempat kerja.
 *
 * Ini BUKAN pelonggaran sepihak. Ia menyamakan front end dengan dua tempat yang
 * sudah memakai aturan yang sama lebih dulu:
 *
 *   - server: `KYC_IDENTITY_PII_ROLES` (`kyc-backoffice.service.ts`) dan
 *     `KYB_PII_ROLES` (`kyb.service.ts`) — keduanya `{STAFF, MANAGER, ADMIN}`.
 *     Artinya plaintext-nya MEMANG sudah dikirim ke STAFF; yang menyembunyikannya
 *     selama ini cuma layar ini.
 *   - kontrak: `sot/conventions.md § Aturan Implementasi` — "Decrypt boundary:
 *     hanya saat backend perlu render PII — backoffice KYC review
 *     (Staff/Manager/Admin)". SOT tidak pernah menyebut ADMIN saja.
 *
 * Gerbang lama (`canReadCustomerPii`, ADMIN saja, USDX-487) membuat layar ini
 * bertentangan dengan dirinya sendiri: di halaman yang sama STAFF melihat nama
 * lengkap, NIK, dan tanggal lahir utuh, tapi `***` untuk nama gadis ibu kandung —
 * padahal NIK jauh lebih sensitif. Akibatnya pencocokan silang dengan KTP hanya
 * bisa dilakukan ADMIN, dan "hasil analisis" yang POJK 8/2023 Pasal 63 ayat (2)
 * huruf c wajibkan ditatausahakan tidak pernah benar-benar ada.
 *
 * ── KENAPA PREDIKAT `canReadCustomerPii` TIDAK LAGI ADA DI BERKAS INI ────────
 *
 * Ia dulu disebut cermin `backend/src/common/customer-pii.util.ts`. Cermin itu
 * sudah tidak akurat dan tidak perlu dipulihkan: predikat ADMIN-saja di server
 * menggerbangi permukaan LAIN — email/telepon di `GET /api/v1/users`, nomor
 * rekening di detail order, ekspor laporan — dan seluruhnya di-mask DI SERVER,
 * sehingga front end tidak pernah menerima nilai yang perlu ia sembunyikan
 * sendiri. Menyimpan predikat ADMIN-saja yang tak berpemakai di sini hanya akan
 * jadi pilihan yang salah yang menunggu diambil orang berikutnya.
 *
 * PENTING — gerbang ini pertahanan berlapis, BUKAN batasnya. Nilainya sudah
 * menyeberangi kabel saat modul ini melihatnya, jadi field yang tersamar tetap
 * terbaca di tab Network. Masking yang otoritatif ada di response backend, dan
 * untuk DEVELOPER backend memang sudah mengirim `"***"` — `presentPii` di sini
 * menyamakan hasilnya, bukan menggantikan lapisan itu.
 */
import type { Staff } from './types'

/**
 * Role yang memutuskan sesuatu atas berkas nasabah — dan karena itu boleh
 * membaca isinya.
 *
 * DAFTAR-IZIN, bukan `role !== 'DEVELOPER'`. Ditulis sebagai daftar-tolak, setiap
 * role baru (dan setiap salah ketik) otomatis mendapat akses PII tanpa ada yang
 * memutuskannya.
 */
const REVIEWER_ROLES: ReadonlySet<Staff['role']> = new Set<Staff['role']>([
  'STAFF',
  'MANAGER',
  'ADMIN',
])

/**
 * `null` / `undefined` staff (sesi masih dimuat, atau sudah dibersihkan 401)
 * diperlakukan sebagai tidak berhak — fail-closed, sama dengan gerbang di server.
 * Karena itu ia menerima baris `Staff` utuh, bukan string role yang bisa
 * tanpa sengaja di-default pemanggil.
 */
export function canReviewCustomerPii(staff: Staff | null | undefined): boolean {
  return staff !== null && staff !== undefined && REVIEWER_ROLES.has(staff.role)
}

/**
 * Bentuk nilai yang disembunyikan. Sama persis dengan token `maskAccountNumber` /
 * `maskIdentityFields` di backend, supaya kedua permukaan terbaca identik dan
 * `KybDetailModal` bisa mengenali nilai yang DISEMBUNYIKAN SERVER dengan
 * membandingkannya terhadap konstanta ini, bukan literal yang diketik dua kali.
 */
export const PII_MASK = '***'

/**
 * Keterangan yang menemani `***`.
 *
 * SATU kalimat untuk dua sebab yang bagi pembacanya sama saja: nilai yang
 * disamarkan backend (`maskIdentityFields`, `maskFields`) dan nilai yang ditahan
 * gerbang di berkas ini. Sebelum USDX-610 ada dua kalimat — "not shown to your
 * role" untuk yang pertama dan "admin only" untuk yang kedua — dan yang kedua
 * sekarang salah: yang tertutup bukan lagi "semua kecuali admin", melainkan
 * DEVELOPER saja. Kalimat yang menyebut role tertentu akan salah lagi pada
 * perubahan berikutnya; kalimat ini menyebut PEMBACANYA, yang selalu benar.
 */
export const PII_WITHHELD_LABEL = 'not shown to your role'

/**
 * Penanda yang dipasang backend di `userEmail` ketika sebuah order tidak punya
 * baris `users` sama sekali — order milik baris `partner_customers` (USDX-571).
 * Cermin `PARTNER_CUSTOMER_EMAIL_LABEL` di
 * `backend/src/common/customer-pii.util.ts`.
 *
 * Diekspor supaya back office MENGENALINYA (mis. merendernya lebih redup
 * daripada alamat sungguhan), tidak pernah untuk memproduksinya: nilainya milik
 * backend, dan mengarangnya di sisi klien akan menyembunyikan lookup yang gagal
 * di balik label yang tampak disengaja.
 */
export const PARTNER_CUSTOMER_EMAIL_LABEL = '(partner customer)'

/**
 * Gerbangi satu string PII berdasarkan role pembacanya.
 *
 * `null` tetap `null` — kolom yang memang kosong (tidak pernah dikumpulkan, atau
 * sudah dibersihkan sweeper retensi) berbeda artinya dari kolom yang ditahan, dan
 * menyatukan keduanya membuat pemeriksa membaca "tidak ada NPWP" padahal
 * kebenarannya "Anda tidak boleh melihatnya". Pemanggil merender `null` sebagai
 * em dash dan nilai tersamar sebagai `***`.
 */
export function presentPii(
  value: string | null | undefined,
  staff: Staff | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null
  return canReviewCustomerPii(staff) ? value : PII_MASK
}

/** True kalau `presentPii` menahan nilai ini — penggerak keterangan "disembunyikan". */
export function isPiiWithheld(
  value: string | null | undefined,
  staff: Staff | null | undefined,
): boolean {
  return Boolean(value) && !canReviewCustomerPii(staff)
}
