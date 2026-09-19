import type { SectionTab } from '@/components/SectionTabs'
import { canManageOncall, canManageSettings } from '@/lib/auth'
import type { Staff } from '@/lib/types'

/**
 * Tab untuk empat halaman Pengaturan yang dulu punya empat entri sidebar
 * sendiri-sendiri (Kurs / Biaya / Batas Safe Manager / Kontak Darurat,
 * § 4 P2-1 audit alur back-office).
 *
 * GERBANGNYA TETAP DI ROUTE. `App.tsx` masih menggerbangi `/settings/threshold`
 * dan `/settings/oncall` ke ADMIN lewat `RoleGuard`; daftar di bawah cuma
 * memutuskan tab mana yang PANTAS DITAWARKAN. Kalau kedua daftar ini pernah
 * berbeda, yang benar adalah `App.tsx` — bukan berkas ini. Preseden dan
 * alasannya ada di `/screening/lists` (USDX-588): menyembunyikan tombol saja
 * meninggalkan halamannya sejauh satu URL.
 *
 * "Mode Mint" SENGAJA BUKAN TAB DI SINI. Ia satu-satunya pengaturan yang
 * terbuka untuk semua peran (USDX-639: STAFF harus bisa mematikan mode uji
 * tanpa mencari atasan), sementara seluruh tab di bawah berhenti di
 * ADMIN/DEVELOPER. Menaruhnya di sini akan menguburnya di belakang gerbang
 * yang tiketnya justru melarang.
 */
export function settingsTabsFor(user: Staff | null): SectionTab[] {
  const tabs: SectionTab[] = []
  // Kurs + Biaya: rutenya terbuka untuk semua peran (baca), tapi hanya peran
  // Settings yang pernah melihat entri menunya — pola itu dipertahankan.
  if (canManageSettings(user)) {
    tabs.push({ to: '/settings/rate', label: 'Kurs' })
    tabs.push({ to: '/settings/fee', label: 'Biaya' })
    // Batas Safe Manager: ADMIN saja, digerbangi di route (sot/phase-1.md L516).
    if (user?.role === 'ADMIN') {
      tabs.push({ to: '/settings/threshold', label: 'Batas Safe Manager' })
    }
  }
  // Kontak Darurat: ADMIN saja termasuk untuk MEMBACA — daftarnya memuat nomor
  // telepon dan menentukan siapa yang menarik rem darurat payout (USDX-485).
  if (canManageOncall(user)) {
    tabs.push({ to: '/settings/oncall', label: 'Kontak Darurat' })
  }
  return tabs
}
