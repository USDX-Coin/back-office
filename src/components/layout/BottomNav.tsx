import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { LayoutDashboard, Coins, Flame, MoreHorizontal } from 'lucide-react'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { cn } from '@/lib/utils'
import MoreDrawer from './MoreDrawer'

// BottomNav mirrors the primary sidebar items per Linear USDX-50 sidebar
// restructure. Mint/Burn carry the same PENDING_APPROVAL badge as the
// desktop sidebar so mobile operators see the same signal.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mint', label: 'Mint', icon: Coins, matchPrefix: '/mint', badge: 'mint' as const },
  { to: '/burn', label: 'Burn', icon: Flame, matchPrefix: '/burn', badge: 'burn' as const },
] as const

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const mintPending = usePendingMintCount()
  const burnPending = usePendingBurnCount()
  const moreActive = ['/users', '/staff', '/settings', '/profile'].some((p) =>
    pathname.startsWith(p)
  )

  function badgeFor(key?: 'mint' | 'burn'): number {
    if (key === 'mint') return mintPending.data ?? 0
    if (key === 'burn') return burnPending.data ?? 0
    return 0
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-stretch border-t border-border bg-background lg:hidden"
        aria-label="Mobile navigation"
      >
        {NAV.map((item) => {
          const isActive =
            'matchPrefix' in item
              ? pathname.startsWith(item.matchPrefix)
              : pathname === item.to
          const Icon = item.icon
          const badge = 'badge' in item ? badgeFor(item.badge) : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-tight transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
              {badge > 0 && (
                <span
                  className="absolute right-[28%] top-1.5 inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground"
                  aria-label={`${badge} pending`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
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
