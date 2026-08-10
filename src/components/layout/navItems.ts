import {
  LayoutDashboard,
  Users,
  UserCog,
  Coins,
  Flame,
  ShieldCheck,
  TrendingUp,
  Sliders,
  CalendarDays,
  UsersRound,
  Wrench,
  Receipt,
  Percent,
  KeyRound,
  PhoneCall,
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

export type BadgeKey = 'mint' | 'burn' | 'kyc'

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
    ],
  },
  {
    // USDX-275 + sot/phase-1.md § Sidebar (TREASURY) + week4.md § Backoffice
    // Multisig Page: self-hosted Safe transaction queue. ADMIN / DEVELOPER /
    // MANAGER (STAFF excluded — signer = Safe owner). No (N) badge on the
    // sidebar entry (status counts live on the page tabs).
    label: 'Treasury',
    visibleWhen: canAccessTreasury,
    items: [{ to: '/multisig', label: 'Multisig', icon: KeyRound }],
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
    label: 'Settings',
    visibleWhen: canManageSettings,
    items: [
      { to: '/settings/rate', label: 'Rate', icon: TrendingUp },
      // USDX-207: fee config (mint fee % + PG fee VA/QRIS). Visible to the
      // Settings section (ADMIN + DEVELOPER); update is admin-only inside.
      { to: '/settings/fee', label: 'Fee', icon: Percent },
      { to: '/settings/threshold', label: 'Threshold', icon: Sliders },
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
