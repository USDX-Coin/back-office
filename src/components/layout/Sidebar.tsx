import { NavLink } from 'react-router'
import { LayoutDashboard, Coins, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/minting', label: 'Minting', icon: Coins },
  { to: '/redeem', label: 'Redeem', icon: ArrowRightLeft },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Mobile: fixed overlay that slides in from left, needs pt-16 to clear navbar
          // Desktop: static flex item that fills the full content area height
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border pt-16',
          'transition-transform duration-200',
          'lg:static lg:z-auto lg:pt-0 lg:h-full lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
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
    </>
  )
}
