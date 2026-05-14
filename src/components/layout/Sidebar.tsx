import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Coins,
  Flame,
  TrendingUp,
  Sliders,
  CalendarDays,
  UsersRound,
} from 'lucide-react'
import {
  canAccessReports,
  canManageSettings,
  canManageStaff,
  useAuth,
} from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import type { Staff } from '@/lib/types'
import { cn } from '@/lib/utils'

type BadgeKey = 'mint' | 'burn'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey?: BadgeKey
  visibleWhen?: (user: Staff | null) => boolean
}

interface NavSection {
  label: string
  items: NavItem[]
  visibleWhen?: (user: Staff | null) => boolean
}

// Sidebar layout per Linear USDX-50 + sot/phase-1.md § Sidebar L452-467.
//
// Role gating:
//   - Staff entry         → ADMIN only (Linear AC; SoT § Pages #8 says non-admin
//                           read-only — Linear takes precedence at the menu
//                           level, see PR Flag-A).
//   - SETTINGS section    → ADMIN + DEVELOPER (SoT § Backoffice Role System
//                           grants `System Config = Ya` to both; Linear writes
//                           "admin only" — see PR Flag-B).
//   - Mint/Burn lists     → visible to all roles. DEVELOPER cannot submit
//                           mint/burn (SoT role table) — the "Add Mint/Burn
//                           OTC" button is hidden inside the page (Flag-E).
const SECTIONS: NavSection[] = [
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
      { to: '/settings/threshold', label: 'Threshold', icon: Sliders },
    ],
  },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Sidebar() {
  const { user } = useAuth()
  const mintPending = usePendingMintCount()
  const burnPending = usePendingBurnCount()

  const visibleSections = SECTIONS.flatMap((section) => {
    if (section.visibleWhen && !section.visibleWhen(user)) return []
    const items = section.items.filter(
      (item) => !item.visibleWhen || item.visibleWhen(user)
    )
    if (items.length === 0) return []
    return [{ ...section, items }]
  })

  function badgeFor(key?: BadgeKey): number {
    if (key === 'mint') return mintPending.data ?? 0
    if (key === 'burn') return burnPending.data ?? 0
    return 0
  }

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-56 lg:shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-[13px] font-bold tracking-tight">
          U
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13.5px] font-semibold tracking-tight">USDX</span>
          <span className="text-[10.5px] text-muted-foreground">
            Operator console
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col px-2 pb-2 pt-1">
        {visibleSections.map((section) => (
          <div key={section.label} className="flex flex-col">
            <div className="px-2 pt-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
              {section.label}
            </div>
            {section.items.map((item) => (
              <SidebarLink
                key={item.to}
                {...item}
                badgeCount={badgeFor(item.badgeKey)}
              />
            ))}
          </div>
        ))}
      </nav>

      {user && (
        <div className="border-t border-border px-2 py-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-border bg-muted text-[10.5px] font-medium">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12.5px] font-medium">
                {user.name}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  badgeCount = 0,
}: NavItem & { badgeCount?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
          isActive
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1">{label}</span>
      {badgeCount > 0 && (
        <span
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-primary-foreground"
          aria-label={`${badgeCount} pending`}
          data-testid={`nav-badge-${to.replace(/^\//, '').replace(/\//g, '-')}`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </NavLink>
  )
}
