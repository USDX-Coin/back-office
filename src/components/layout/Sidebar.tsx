import { NavLink } from 'react-router'
import { LayoutDashboard, Coins, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/minting', label: 'Minting', icon: Coins },
  { to: '/redeem', label: 'Redeem', icon: ArrowRightLeft },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:h-full lg:w-64 lg:shrink-0 flex-col border-r border-border bg-card">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-light text-primary-dark'
                  : 'text-muted hover:bg-gray-100 hover:text-dark'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
