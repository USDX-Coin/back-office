import { Coins, Landmark, Receipt, Sliders, Users } from 'lucide-react'
import {
  canAccessReports,
  canAccessRequestList,
  canManageSettings,
  canManageStaff,
  canReadDurianpayApiCalls,
} from '@/lib/auth'
import { canReadActivityLog } from '@/features/activity-log/access'
import type { Staff, StaffRole } from '@/lib/types'

/**
 * Kunci angka antrean di menu. Angkanya dihitung `useNavBadges`.
 *
 *   transactions — `queue-counts.transactionsNeedsAction` (fase 2, ⚠️ DRAF SOT
 *                  PR #50): baris Transaksi yang perlu tindakan.
 *   otc          — permintaan OTC berstatus PENDING_APPROVAL / APPROVED
 *   verification — berkas KYC + KYB yang menunggu diperiksa
 *   screening    — temuan daftar sanksi yang masih menahan subjeknya
 *   approvals    — usulan Persetujuan Orang Kedua yang belum kedaluwarsa
 */
export type BadgeKey = 'transactions' | 'otc' | 'verification' | 'screening' | 'approvals'

export interface NavItem {
  to: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  badgeKey?: BadgeKey
  visibleWhen?: (user: Staff | null) => boolean
  /**
   * Awalan rute lain yang dianggap "di dalam" menu ini — untuk menyorot menu
   * dan menyusun breadcrumb (mis. Transaksi menaungi halaman antrean lama).
   */
  match?: string[]
}

export interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

export type NavEntry = ({ kind: 'item' } & NavItem) | ({ kind: 'group' } & NavGroup)

// ─────────────────────────────────────────────────────────────────────────────
// REDESAIN FASE 1 (keputusan PM 9 Okt 2026) — 5 menu utama.
//
//   Transaksi            satu tabel transaksi (fase 2); sekarang halaman lama
//   OTC                  mint OTC + redeem OTC + tanda tangan multisig
//   Nasabah ▸            Daftar Nasabah · Verifikasi · Daftar Sanksi
//   Keuangan ▸           Rekening BNI · Laporan · Cadangan & Atestasi
//   Pengaturan ▸         Kurs & Biaya · Mode Mint · Plafon Pencairan ·
//                        Staf & Peran · Persetujuan Orang Kedua · Jejak Audit ·
//                        Log DurianPay
//
// Beranda dihapus. Persetujuan Pencairan, Pencairan Bermasalah, Mint
// Bermasalah dan Perbaiki Status Nyangkut TIDAK tampil di menu tapi rutenya
// tetap hidup (fase 2 meleburnya ke Transaksi); angka antreannya dijumlah ke
// menu Transaksi. Antrean Tanda Tangan juga keluar dari menu — alurnya pindah
// ke panel OTC — dan halamannya tetap bisa dibuka lewat URL.
//
// GERBANG PERAN TIDAK IKUT DIRAPIKAN: tiap `visibleWhen` di bawah adalah
// gerbang yang sama persis dengan menu sebelumnya, dan gerbang rutenya tetap
// di `App.tsx`. Menu tidak pernah jadi satu-satunya gerbang untuk apa pun.
//   - OTC           → `canAccessRequestList` (STAFF tidak boleh membaca
//                     /api/v1/requests maupun /api/v1/multisig, sot/phase-1.md L34)
//   - Laporan       → `canAccessReports`
//   - Cadangan      → `canManageSettings`
//   - Kurs & Biaya  → `canManageSettings` (tab per halaman tetap digerbangi rute)
//   - Staf & Peran  → `canManageStaff`
//   - Jejak Audit   → `canReadActivityLog`
//   - Log DurianPay → `canReadDurianpayApiCalls`
//   - Mode Mint & Plafon Pencairan tetap SEMUA peran: rem darurat yang harus
//     bisa dicapai STAFF tanpa mencari atasan (USDX-639).
// ─────────────────────────────────────────────────────────────────────────────
export const NAV: NavEntry[] = [
  {
    kind: 'item',
    to: '/transactions',
    label: 'Transaksi',
    icon: Receipt,
    badgeKey: 'transactions',
    match: ['/transactions', '/redeem-approvals', '/payout-failures', '/mint-bermasalah', '/manual-sync'],
  },
  {
    kind: 'item',
    to: '/otc',
    label: 'OTC',
    icon: Coins,
    badgeKey: 'otc',
    visibleWhen: canAccessRequestList,
    match: ['/otc', '/mint', '/burn', '/multisig'],
  },
  {
    kind: 'group',
    id: 'nasabah',
    label: 'Nasabah',
    icon: Users,
    items: [
      { to: '/users', label: 'Daftar Nasabah' },
      { to: '/verifikasi', label: 'Verifikasi', badgeKey: 'verification', match: ['/verifikasi', '/kyc', '/kyb'] },
      { to: '/screening', label: 'Daftar Sanksi', badgeKey: 'screening' },
    ],
  },
  {
    kind: 'group',
    id: 'keuangan',
    label: 'Keuangan',
    icon: Landmark,
    items: [
      { to: '/bni-accounts', label: 'Rekening BNI' },
      { to: '/reports/mint/daily', label: 'Laporan', visibleWhen: canAccessReports, match: ['/reports'] },
      { to: '/transparency', label: 'Cadangan & Atestasi', visibleWhen: canManageSettings },
    ],
  },
  {
    kind: 'group',
    id: 'pengaturan',
    label: 'Pengaturan',
    icon: Sliders,
    items: [
      {
        to: '/settings/rate',
        label: 'Kurs & Biaya',
        visibleWhen: canManageSettings,
        match: ['/settings/rate', '/settings/fee', '/settings/threshold', '/settings/oncall'],
      },
      { to: '/settings/mint-mode', label: 'Mode Mint' },
      { to: '/plafon-pencairan', label: 'Plafon Pencairan' },
      { to: '/staff', label: 'Staf & Peran', visibleWhen: canManageStaff },
      { to: '/persetujuan', label: 'Persetujuan Orang Kedua', badgeKey: 'approvals' },
      { to: '/jejak-audit', label: 'Jejak Audit', visibleWhen: canReadActivityLog },
      { to: '/durianpay-api-calls', label: 'Log DurianPay', visibleWhen: canReadDurianpayApiCalls },
    ],
  },
]

/** Menu yang boleh dilihat `user` — grup yang kosong dibuang. */
export function visibleNav(user: Staff | null): NavEntry[] {
  return NAV.flatMap((entry): NavEntry[] => {
    if (entry.kind === 'item') return !entry.visibleWhen || entry.visibleWhen(user) ? [entry] : []
    const items = entry.items.filter((i) => !i.visibleWhen || i.visibleWhen(user))
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Apakah `pathname` berada di bawah menu `item`. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  return [item.to, ...(item.match ?? [])].some((p) => pathMatches(pathname, p))
}

// Halaman yang bukan entri menu sendiri tapi punya nama yang lebih tepat
// daripada nama menu induknya. Dicek DULUAN (paling spesifik).
const EXTRA_CRUMBS: Array<{ prefix: string; exact?: boolean; crumbs: string[] }> = [
  { prefix: '/mint/new', exact: true, crumbs: ['OTC', 'Buat mint OTC'] },
  { prefix: '/burn/new', exact: true, crumbs: ['OTC', 'Buat redeem OTC'] },
  { prefix: '/multisig', crumbs: ['OTC', 'Halaman tanda tangan'] },
  { prefix: '/redeem-approvals', crumbs: ['Transaksi', 'Persetujuan Pencairan'] },
  { prefix: '/payout-failures', crumbs: ['Transaksi', 'Pencairan Bermasalah'] },
  { prefix: '/mint-bermasalah', crumbs: ['Transaksi', 'Mint Bermasalah'] },
  { prefix: '/manual-sync', crumbs: ['Transaksi', 'Perbaiki Status Nyangkut'] },
  { prefix: '/kyb/new', exact: true, crumbs: ['Nasabah', 'Verifikasi', 'Tambah berkas badan usaha'] },
  { prefix: '/screening/lists', exact: true, crumbs: ['Nasabah', 'Daftar Sanksi', 'Versi daftar'] },
  { prefix: '/users', crumbs: ['Nasabah', 'Daftar Nasabah'] },
  { prefix: '/profile', crumbs: ['Akun', 'Profil'] },
]

/**
 * Breadcrumb dari tabel menu — TIDAK PERNAH dari potongan URL. Audit 8 Okt
 * 2026: "USDX › jejak-audit" dan "users › 00000000-…" membocorkan slug dan
 * UUID ke layar. Rute tak dikenal jatuh ke "USDX" saja.
 */
export function breadcrumbFor(pathname: string): string[] {
  for (const e of EXTRA_CRUMBS) {
    if (e.exact ? pathname === e.prefix : pathMatches(pathname, e.prefix)) {
      // Halaman profil satu nasabah: tambahkan namanya secara umum, bukan id-nya.
      if (e.prefix === '/users' && pathname !== '/users') return [...e.crumbs, 'Profil nasabah']
      return e.crumbs
    }
  }
  for (const entry of NAV) {
    if (entry.kind === 'item') {
      if (isItemActive(entry, pathname)) return [entry.label]
      continue
    }
    const item = entry.items.find((i) => isItemActive(i, pathname))
    if (item) return [entry.label, item.label]
  }
  return ['USDX']
}

const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staf',
  DEVELOPER: 'Developer',
}

export function formatRole(role: string): string {
  return ROLE_LABEL[role as StaffRole] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}
