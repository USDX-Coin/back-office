import {
  LayoutDashboard,
  Users,
  UserCog,
  Coins,
  Flame,
  ShieldCheck,
  Building2,
  TrendingUp,
  Sliders,
  CalendarDays,
  UsersRound,
  Wrench,
  Receipt,
  Percent,
  KeyRound,
  Landmark,
  PhoneCall,
  ShieldAlert,
  FlaskConical,
  Banknote as BanknoteIcon,
  BanknoteX,
} from 'lucide-react'
import {
  canAccessReports,
  canManageOncall,
  canAccessRequestList,
  canAccessTreasury,
  canManageSettings,
  canManageStaff,
} from '@/lib/auth'
import type { Staff } from '@/lib/types'

export type BadgeKey =
  | 'mint'
  | 'burn'
  | 'kyc'
  | 'kyb'
  | 'screening'
  | 'redeemApprovals'
  | 'payoutFailures'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey?: BadgeKey
  visibleWhen?: (user: Staff | null) => boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
  visibleWhen?: (user: Staff | null) => boolean
}

// Single source of truth for the app navigation — consumed by the desktop
// Sidebar and the mobile MobileNavDrawer (USDX-27 replaced the bottom nav with
// a hamburger drawer, so there is now exactly one nav tree to keep in sync).
//
// Layout per Linear USDX-50 + sot/phase-1.md § Sidebar L452-467.
//
// Role gating:
//   - Staff entry         → ADMIN only (Linear AC; SoT § Pages #8 says non-admin
//                           read-only — Linear takes precedence at the menu
//                           level, see PR Flag-A).
//   - SETTINGS section    → ADMIN + DEVELOPER (SoT § Backoffice Role System
//                           grants `System Config = Ya` to both; Linear writes
//                           "admin only" — see PR Flag-B).
//   - Mint/Burn lists     → ADMIN / DEVELOPER / MANAGER navigate to the list
//                           (`/mint`, `/burn`) with the (N) PENDING_APPROVAL
//                           badge. STAFF navigates directly to the form
//                           (`/mint/new`, `/burn/new`) with no badge —
//                           sot/phase-1.md L34 + L653-655 (USDX-78). DEVELOPER
//                           cannot submit mint/burn (SoT role table) — the
//                           "Add Mint/Burn OTC" button is hidden inside the
//                           page (Flag-E).
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/users', label: 'Users', icon: Users },
      { to: '/staff', label: 'Staff', icon: UserCog, visibleWhen: canManageStaff },
    ],
  },
  {
    label: 'OTC',
    items: [
      { to: '/mint', label: 'Mint', icon: Coins, badgeKey: 'mint' },
      { to: '/burn', label: 'Burn', icon: Flame, badgeKey: 'burn' },
    ],
  },
  {
    // USDX-206 + sot/phase-2/week2.md § Backoffice — User Transaction:
    // read-only monitoring of consumer mint orders. Visible to every backoffice
    // role (no visibleWhen) — distinct from the OTC desk above (different table
    // / lifecycle). Redeem orders join the same menu in Week 3.
    label: 'Consumer',
    items: [
      { to: '/transactions', label: 'User Transaction', icon: Receipt },
      // USDX-669 — antrean Persetujuan Pencairan. ENTRI SENDIRI, bukan tab di
      // dalam User Transaction (keputusan PM): yang satu monitoring read-only
      // atas semua order, yang satu antrean kerja yang mengeluarkan rupiah, dan
      // menyatukannya membuat pekerjaan yang menunggu tidak punya tempat yang
      // bisa dihitung. Duduk di section Consumer karena subjeknya order redeem
      // konsumen — yang dilarang tiket adalah menempelkannya pada LAYAR
      // Transactions, bukan menaruhnya di kelompok yang sama.
      //
      // Visibilitas: SEMUA peran, pola KYC/KYB/Screening. Menyetujui dan menolak
      // digerbangi MANAGER/ADMIN di dalam layarnya (`canDecideRedeemPayout`) —
      // STAFF yang melihat antrean menumpuk adalah cara seseorang tahu harus
      // memanggil yang berwenang, dan badge `(N)` ikut tampil untuknya karena
      // `GET /api/v1/redeem-approvals` terbuka untuk peran itu.
      {
        to: '/redeem-approvals',
        label: 'Persetujuan Pencairan',
        icon: BanknoteIcon,
        badgeKey: 'redeemApprovals',
      },
    ],
  },
  {
    // USDX-154 + sot/phase-2/week1.md § Backoffice Approval Menu — Sidebar:
    // KYC Review is visible to ALL roles (Admin/Manager/Staff/Developer;
    // approve/reject is gated inside the detail, not at the menu). Unlike
    // Mint/Burn, the (N) badge also renders for STAFF — GET /api/v1/kyc is
    // staff-accessible per week1.md § Authorization Guard role matrix.
    label: 'Compliance',
    items: [
      { to: '/kyc', label: 'KYC Review', icon: ShieldCheck, badgeKey: 'kyc' },
      // USDX-546 — KYB Review sits beside KYC Review and follows the same
      // visibility rule (all roles read; DEVELOPER cannot act). Its own entry
      // rather than a tab inside KYC: the two carry different data (an entity
      // plus its UBOs versus one person) and KYB additionally has a data-entry
      // form, because KYB is manual.
      { to: '/kyb', label: 'KYB Review', icon: Building2, badgeKey: 'kyb' },
      // USDX-588 — antrean screening DTTOT & DPPSPM. Aturan visibilitas sama
      // dengan KYC/KYB: semua role membaca antrean, memutuskan digerbangi di
      // dalam. Badge `(N)` menghitung temuan yang MASIH MENAHAN subjeknya
      // (`open=true`), bukan yang belum disentuh — temuan yang sudah diputus
      // CONFIRMED_MATCH tetap menahan, dan angka yang mengecualikannya akan
      // menyatakan pekerjaan sudah selesai padahal ada nasabah yang tertahan.
      { to: '/screening', label: 'Screening', icon: ShieldAlert, badgeKey: 'screening' },
      // Transparency: the append-only reserve ledger + attestation reports
      // behind the public usdx.co.id figures. Read audience is ADMIN +
      // DEVELOPER (KONTRAK-API-TRANSPARANSI.md § 3), which is exactly what
      // canManageSettings already resolves to; the route itself is guarded by
      // RoleGuard in App.tsx, so this only controls menu noise. Recording
      // entries is ADMIN-only (canManageTransparency) and re-enforced by the BE.
      {
        to: '/transparency',
        label: 'Transparency',
        icon: Landmark,
        visibleWhen: canManageSettings,
      },
    ],
  },
  {
    // sot/phase-1.md § Sidebar (TREASURY): visible to EVERY role since
    // USDX-631 (D21) — the gate moved from the section to its items.
    //   - Multisig (USDX-275 + week4.md § Backoffice Multisig Page): self-hosted
    //     Safe transaction queue, ADMIN / DEVELOPER / MANAGER (STAFF excluded —
    //     signer = Safe owner). No (N) badge (status counts live on the tabs).
    //   - Rekening BNI (USDX-631, sot/bni-integration.md § 16 K5): LIVE
    //     balances + statements of the three MAF accounts, all roles including
    //     STAFF (PM decision 2026-09-09). Read-only; route has no RoleGuard.
    label: 'Treasury',
    items: [
      { to: '/multisig', label: 'Multisig', icon: KeyRound, visibleWhen: canAccessTreasury },
      { to: '/bni-accounts', label: 'Rekening BNI', icon: Landmark },
      // USDX-662 — antrean Pencairan Bermasalah (§ 17.9). Linear menunjuk "sidebar
      // TREASURY/OPS"; § 17.9 menyebut "satu grup dengan Mint Bermasalah", menu yang
      // tidak ada di back-office ini, jadi section TREASURY yang dipakai. Visibilitas
      // SEMUA peran tanpa `visibleWhen` (list terbuka untuk STAFF/DEVELOPER, pola
      // Rekening BNI); resolve digerbangi MANAGER/ADMIN di dalam layar. Badge `(N)` =
      // antrean terbuka, tampil untuk semua peran: tiap satuannya rupiah yang belum sampai.
      {
        to: '/payout-failures',
        label: 'Pencairan Bermasalah',
        icon: BanknoteX,
        badgeKey: 'payoutFailures',
      },
    ],
  },
  {
    // USDX-81 + sot/phase-1.md § Reporting access: ADMIN + DEVELOPER + MANAGER.
    // STAFF never sees these entries; BE also enforces 403.
    label: 'Reporting',
    visibleWhen: canAccessReports,
    items: [
      { to: '/reports/mint/daily', label: 'Daily Mint', icon: CalendarDays },
      { to: '/reports/mint/by-user', label: 'Mint By User', icon: UsersRound },
      { to: '/reports/burn/daily', label: 'Daily Burn', icon: CalendarDays },
      { to: '/reports/burn/by-user', label: 'Burn By User', icon: UsersRound },
    ],
  },
  {
    // USDX-639: gerbang section DIPINDAH ke item-itemnya, mengikuti preseden
    // TREASURY (USDX-631 D21). Alasannya sama bentuknya: satu entri baru di
    // section ini — Mode Mint — harus terlihat oleh SEMUA role, sementara
    // Rate / Fee / Threshold / On-Call tetap persis seperti sebelumnya. Menaruh
    // gerbang lama di section akan menyembunyikan Mode Mint dari STAFF dan
    // MANAGER, yaitu dua role yang justru diminta tiketnya bisa membukanya.
    label: 'Settings',
    items: [
      { to: '/settings/rate', label: 'Rate', icon: TrendingUp, visibleWhen: canManageSettings },
      // USDX-207: fee config (mint fee % + PG fee VA/QRIS). Visible to the
      // Settings section (ADMIN + DEVELOPER); update is admin-only inside.
      { to: '/settings/fee', label: 'Fee', icon: Percent, visibleWhen: canManageSettings },
      // USDX-639 — mode mint PROD/UJI. SATU-SATUNYA entri Settings yang terbuka
      // untuk semua role: STAFF yang menyadari mode uji menyala di jam produksi
      // harus bisa sampai ke tombol yang mematikannya tanpa mencari atasan.
      { to: '/settings/mint-mode', label: 'Mode Mint', icon: FlaskConical },
      {
        to: '/settings/threshold',
        label: 'Threshold',
        icon: Sliders,
        visibleWhen: canManageSettings,
      },
      // USDX-485 (audit P1-18): kontak on-call insiden uang. Di-gate di level
      // ITEM, bukan mengikuti section (canManageSettings = ADMIN+DEVELOPER):
      // daftarnya memuat nomor telepon dan menentukan siapa yang dipanggil saat
      // uang bermasalah, jadi DEVELOPER pun tidak melihatnya.
      {
        to: '/settings/oncall',
        label: 'On-Call',
        icon: PhoneCall,
        visibleWhen: canManageOncall,
      },
    ],
  },
  // USDX-87: Manual Sync — recovery tool for stuck PENDING_APPROVAL / APPROVED
  // requests when auto Status Sync fails (sot/phase-1.md § Manual Sync). All
  // roles can access; staff need it because Manual Sync is an on-call
  // emergency surface (sot/phase-1.md L583+ "Akses: all roles").
  {
    label: 'Troubleshooting',
    items: [
      { to: '/manual-sync', label: 'Manual Sync', icon: Wrench },
    ],
  },
]

/** Sections + items filtered to what `user`'s role may see (empty sections dropped). */
export function visibleNavSections(user: Staff | null): NavSection[] {
  const canViewLists = canAccessRequestList(user)
  return NAV_SECTIONS.flatMap((section) => {
    if (section.visibleWhen && !section.visibleWhen(user)) return []
    const items = section.items
      .filter((item) => !item.visibleWhen || item.visibleWhen(user))
      .map((item) => {
        // USDX-78: STAFF can't access /mint or /burn lists — redirect Mint/Burn
        // nav entries to the form and drop the (N) badge.
        if (canViewLists) return item
        if (item.badgeKey === 'mint') return { ...item, to: '/mint/new', badgeKey: undefined }
        if (item.badgeKey === 'burn') return { ...item, to: '/burn/new', badgeKey: undefined }
        return item
      })
    if (items.length === 0) return []
    return [{ ...section, items }]
  })
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

export function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
