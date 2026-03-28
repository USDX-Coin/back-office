import { NavLink } from 'react-router'
import { LayoutDashboard, Coins, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/minting', label: 'Minting', icon: Coins },
  { to: '/redeem', label: 'Redeem', icon: ArrowRightLeft },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border bg-card lg:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                  isActive ? 'bg-primary-light' : ''
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
