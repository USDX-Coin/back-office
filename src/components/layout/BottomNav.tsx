import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { LayoutDashboard, ArrowRightLeft, BarChart3, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import MoreDrawer from './MoreDrawer'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/otc', label: 'OTC', icon: ArrowRightLeft, matchPrefix: '/otc' },
  { to: '/report', label: 'Report', icon: BarChart3 },
] as const

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = ['/users', '/staff', '/profile'].some((p) => pathname.startsWith(p))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-stretch border-t border-border bg-background lg:hidden"
        aria-label="Mobile navigation"
      >
        {NAV.map((item) => {
          const isActive =
            'matchPrefix' in item
              ? pathname.startsWith((item as { matchPrefix: string }).matchPrefix)
              : pathname === item.to
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-tight transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-tight transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="More menu"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
          More
        </button>
      </nav>
      <MoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
