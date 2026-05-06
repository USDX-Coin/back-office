import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  Users,
  ArrowUpFromLine,
  ArrowDownToLine,
  ListChecks,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  label: string
  items: NavItem[]
}

// SoT phase-1.md sidebar list: Dashboard, Mint, Burn, Requests, Users, Rate.
// Burn label + Rate entry deferred until USDX-40 (Mint/Burn integration) and a
// Rate page integration ticket land — see USDX-43.
const SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'OTC Desk',
    items: [
      { to: '/otc/mint', label: 'Mint', icon: ArrowUpFromLine },
      { to: '/otc/redeem', label: 'Redeem', icon: ArrowDownToLine },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/requests', label: 'Requests', icon: ListChecks }],
  },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function formatRole(role: string): string {
  // SoT enum is upper-case (STAFF/MANAGER/DEVELOPER/ADMIN). Render title-case.
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Sidebar() {
  const { user } = useAuth()

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
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col">
            <div className="px-2 pt-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
              {section.label}
            </div>
            {section.items.map((item) => (
              <SidebarLink key={item.to} {...item} />
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
              <span
                className="truncate text-[11px] text-muted-foreground"
                data-testid="staff-role"
              >
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function SidebarLink({ to, label, icon: Icon }: NavItem) {
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
      <span>{label}</span>
    </NavLink>
  )
}
