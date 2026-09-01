import { NavLink } from 'react-router'
import { canAccessRequestList, useAuth } from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { usePendingKycCount } from '@/features/kyc/hooks'
import { usePendingKybCount } from '@/features/kyb/hooks'
import { useOpenScreeningCount } from '@/features/screening/hooks'
import { cn } from '@/lib/utils'
import {
  visibleNavSections,
  getInitials,
  formatRole,
  type BadgeKey,
  type NavItem,
} from './navItems'

export default function Sidebar() {
  const { user } = useAuth()
  // USDX-78 — STAFF cannot access /api/v1/requests* (sot/phase-1.md L34) so
  // skip the count queries; the badge is also hidden for STAFF via the
  // mint/burn item rewrite in visibleNavSections().
  const canViewLists = canAccessRequestList(user)
  const mintPending = usePendingMintCount({ enabled: canViewLists })
  const burnPending = usePendingBurnCount({ enabled: canViewLists })
  // USDX-154 — KYC Review badge counts PENDING submissions. No `enabled`
  // gate: GET /api/v1/kyc is accessible to every role incl. STAFF
  // (week1.md § Authorization Guard).
  const kycPending = usePendingKycCount()
  // USDX-546 — same reasoning as the KYC badge: the KYB queue is readable by
  // every role, so no `enabled` gate.
  const kybPending = usePendingKybCount()
  // USDX-588 — alasan sama: antrean screening terbuka untuk semua role, jadi
  // tidak ada gerbang `enabled`.
  const screeningOpen = useOpenScreeningCount()

  const sections = visibleNavSections(user)

  function badgeFor(key?: BadgeKey): number {
    if (key === 'mint') return mintPending.data ?? 0
    if (key === 'burn') return burnPending.data ?? 0
    if (key === 'kyc') return kycPending.data ?? 0
    if (key === 'kyb') return kybPending.data ?? 0
    if (key === 'screening') return screeningOpen.data ?? 0
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

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1">
        {sections.map((section) => (
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
        <div className="shrink-0 border-t border-border px-2 py-2">
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
