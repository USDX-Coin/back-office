import type { SectionTab } from '@/components/SectionTabs'

/**
 * Tab untuk empat halaman Laporan yang dulu punya empat entri sidebar
 * sendiri-sendiri (§ 4 P2-1 audit alur back-office).
 *
 * Rutenya TIDAK berubah — bookmark lama tetap hidup, dan `RoleGuard`
 * ADMIN/DEVELOPER/MANAGER di `App.tsx` tetap menjadi gerbangnya. Keempatnya
 * punya gerbang yang sama, jadi tidak ada tab yang perlu disembunyikan per
 * peran di sini.
 */
export const REPORT_TABS: readonly SectionTab[] = [
  { to: '/reports/mint/daily', label: 'Mint Harian' },
  { to: '/reports/mint/by-user', label: 'Mint per Nasabah' },
  { to: '/reports/burn/daily', label: 'Burn Harian' },
  { to: '/reports/burn/by-user', label: 'Burn per Nasabah' },
]
