import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  LayoutDashboard,
  Users,
  UserCog,
  ArrowRightLeft,
  BarChart3,
  ChevronDown,
  Coins,
  Wallet,
  CircleCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

interface NavGroup extends NavItem {
  children?: NavItem[]
}

const NAV: NavGroup[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'User', icon: Users },
  { to: '/staff', label: 'Staf', icon: UserCog },
  {
    to: '/otc',
    label: 'OTC',
    icon: ArrowRightLeft,
    children: [
      { to: '/otc/mint', label: 'Mint', icon: Coins },
      { to: '/otc/redeem', label: 'Redeem', icon: Wallet },
    ],
  },
  { to: '/report', label: 'Report', icon: BarChart3 },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const onOtcRoute = pathname.startsWith('/otc')
  const [manualOpen, setManualOpen] = useState(false)
  const openOtc = onOtcRoute || manualOpen

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-64 lg:shrink-0 flex-col border-r border-outline-variant/15 bg-surface-container-low">
      <nav className="flex flex-1 flex-col gap-0.5 p-4">
        {NAV.map((item) => {
          if (item.children) {
            const groupActive = pathname.startsWith(item.to)
            const Icon = item.icon
            return (
              <div key={item.to}>
                <button
                  type="button"
                  onClick={() => setManualOpen((v) => !v)}
                  aria-expanded={openOtc}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    groupActive
                      ? 'text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', groupActive && 'text-primary')} />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', openOtc && 'rotate-180')}
                  />
                </button>
                {openOtc && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <SidebarLink key={child.to} {...child} indent />
                    ))}
                  </div>
                )}
              </div>
            )
          }
          return <SidebarLink key={item.to} {...item} />
        })}
      </nav>

      <div className="m-4 rounded-xl bg-surface-container-lowest p-3 shadow-ambient-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="text-xs font-medium text-on-surface">System Status</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant">
          <CircleCheck className="h-3 w-3 text-success" />
          Node operational
        </p>
      </div>
    </aside>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  indent,
}: NavItem & { indent?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          indent && 'pl-10',
          isActive
            ? 'bg-primary-container/15 text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !indent && (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
          {label}
        </>
      )}
    </NavLink>
  )
}
